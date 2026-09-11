# 06 - AI-Assisted Project Setup (Blueprint)

## Vision

A user who wants to start a project should not have to manually configure columns. They type a plain-language description ("a SaaS marketing site project", "an Android app launch") and the **AI generates a full blueprint** — project name, description, and an ordered list of **Stages** (the workflow) — so the project is fully set up and ready for tasks.

```
user prompt ──► ProjectBlueprint { name, description, stages: StageDraft[] }
```

Nothing is persisted by the AI. The user **reviews/edits** the blueprint, then creates the project — the existing `CreateProjectUseCase` consumes the blueprint's stages.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| AI is an **external technology behind a port** | Hexagonal: `ProjectBlueprintGeneratorPort` lives in `domain/ports/`; the OpenAI/SDK adapter lives in `infrastructure/ai/`. Domain/application never import an SDK. |
| The blueprint is a **transient Value Object**, not an aggregate | `ProjectBlueprint` is a proposal, never saved. The only persisted thing is the resulting `Project` + `Stage[]` via the normal create flow. |
| No new bounded context | Blueprint generation is a **Project Management** capability. The invariant rules for a valid workflow (1..20 stages, unique names, one `isDone`) already live in the `Project` aggregate — the AI output is validated against the *same* rules as manual creation. |
| Model output is **untrusted data** | Structured outputs are parsed, clamped, re-validated, and never executed. Failure or invalid output → fall back to the default 5-stage workflow. |

## Flow (Confirm-then-Create, two steps)

```
Step 1                                    Step 2
POST /api/projects/blueprint             POST /api/projects
{ prompt: "..." }  ────────────────►    { name, description,
                                          stages: [ {name, color, isDone}, ... ] }
   GenerateProjectBlueprintUseCase           CreateProjectUseCase
     │                                        │  Project.create(name, stages)  ← same
     │  call BlueprintGeneratorPort            │   invariants as manual creation
     │  validate + normalize                   ▼
     ▼                                      Project + Stages persisted
   returns ProjectBlueprint (NOT saved)     ProjectCreatedEvent raised
     │
     └── user reviews/edits in UI, then Step 2
```

## Domain Model (Project Management context)

| Type | Name | Description |
|------|------|-------------|
| **Value Object** | `ProjectBlueprint` | Immutable proposal: `{ name, description?, stages: StageDraft[] }`. Never persisted. |
| **Value Object** | `StageDraft` | Single proposed column: `{ name, color?, isDone? }` |
| **Port** | `ProjectBlueprintGeneratorPort` | `generate(input): Promise<ProjectBlueprint \| null>` — returns `null` on failure so the application can fall back to defaults |

```typescript
// modules/project-management/domain/ports/project-blueprint-generator.port.ts
export interface BlueprintGenerationInput {
  prompt: string;
  projectType?: string; // optional hint, e.g. "software", "marketing", "event"
}

export interface ProjectBlueprintGeneratorPort {
  generate(input: BlueprintGenerationInput): Promise<ProjectBlueprint | null>;
}
```

**Invariants** — enforced by `Project.create(ownerId, name, description, stages)` in the `Project` aggregate — the **exact same code path** as manual stage management (`AddStageUseCase`):

- 1..20 stages; names unique (case-insensitive) within the project
- Exactly one stage flagged `isDone` — if the AI omits it, the aggregate auto-flags the **last** stage
- Positions assigned **gap-free** by the aggregate (the `StagePosition` rules)
- Non-empty stage/project names

## Use Case: Generate Project Blueprint

```
GenerateProjectBlueprintUseCase.execute({ userId, prompt, projectType? })

  1. (interfaces layer) — authenticate user
  2. Validate input: prompt non-empty, ≤ 2000 chars (project.validator)
  3. Call ProjectBlueprintGeneratorPort.generate({ prompt, projectType })
  4. If result is null OR fails `Project.create()` invariants:
        → fall back to the default blueprint (Backlog, To Do, In Progress, In Review, Done)
  5. Return ProjectBlueprint  ← nothing persisted, nothing creates stages yet
```

**Boundary**: Project Management Context. The caller (blueprint endpoint) never creates anything; creation stays the job of `CreateProjectUseCase`.

## Use Case: Create Project (Extended — accepts stages)

```
CreateProjectUseCase.execute({ ownerId, name?, description?, stages?: StageDraft[] })

  1. If stages omitted → use default 5 stages
  2. Project.create(ownerId, name, description, stages)
       — enforces the invariants above (max 20, unique names, gap-free, one isDone)
  3. Persist via ProjectRepository; raise ProjectCreatedEvent
  4. Return Project aggregate with Stages
```

`POST /api/projects` now accepts an optional `stages` array. Clients that called the blueprint endpoint simply post the blueprint fields back (optionally after editing them).

## API

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/projects/blueprint` | Generate project blueprint from a prompt (AI, **no writes**) | `GenerateProjectBlueprintUseCase` |
| POST | `/api/projects` | Create project — `stages` optional (from blueprint or manual) | `CreateProjectUseCase` |

**Request — blueprint**

```json
POST /api/projects/blueprint
{ "prompt": "A mobile app for booking dog walks", "projectType": "software" }
```

**Response — blueprint** (200, not persisted)

```json
{
  "name": "DogWalks Mobile App",
  "description": "Booking and scheduling for dog walkers",
  "stages": [
    { "name": "Backlog", "color": "#94a3b8" },
    { "name": "Design", "color": "#8b5cf6" },
    { "name": "Development", "color": "#3b82f6" },
    { "name": "QA", "color": "#f59e0b" },
    { "name": "Done", "color": "#22c55e", "isDone": true }
  ]
}
```

**Request — create** (the client confirms/edits, then posts)

```json
POST /api/projects
{
  "name": "DogWalks Mobile App",
  "description": "Booking and scheduling for dog walkers",
  "stages": [
    { "name": "Backlog", "color": "#94a3b8" },
    { "name": "Done", "color": "#22c55e", "isDone": true }
  ]
}
```

## Infrastructure: OpenAI Adapter (behind the port)

- `common/llm/` — shared LLM client (provider interface + OpenAI/Anthropic implementation), selected via env (`LLM_PROVIDER`, `OPENAI_API_KEY`, `LLM_MODEL`).
- `infrastructure/ai/openai-blueprint-generator.adapter.ts` — implements `ProjectBlueprintGeneratorPort`:
  - Builds a **fixed system prompt** describing the JSON contract (never interpolates user input into the system prompt);
  - Uses **structured/JSON-schema output** to force `{ name, description?, stages[] }`;
  - Parses + **normalizes** the response (clamps stage count to ≤ 20, drops empty/duplicate names, default colors, ensures a terminal `isDone`);
  - Returns `null` on any provider error/timeout/bad shape → application falls back to the default workflow.

> The adapter is the **only** place that knows about the LLM. Domain and application are oblivious to which provider is used.

## Cross-Cutting Concerns

- **Auth**: both endpoints require the existing `authenticate` JWT middleware.
- **Rate limiting**: reuse `rateLimiter` on the blueprint endpoint — every call has a real LLM cost.
- **Cost caps**: limit generated stages (≤ 20), prompt length (≤ 2000 chars); make `LLM_MAX_STAGES` configurable.
- **Security**: model output is data, not instructions — it is validated against domain invariants and never executed.

## Testing

- **Unit**: `Project.create()` invariant tests with blueprint stages (count, uniqueness, `isDone`, gap-free); `GenerateProjectBlueprintUseCase` with an **injected fake** `ProjectBlueprintGeneratorPort`.
- **Adapter**: provider adapter tested against a recorded fixture (no live API in CI).
- **Integration**: two-step flow — `POST /blueprint` (fake port) → `POST /projects` with returned stages → GET project returns stages in order.
- **Fallback**: generator returns `null` → blueprint endpoint returns the default 5-stage blueprint.

## Open Questions

1. **Starter tasks**: should the AI also propose a few starter tasks per stage? (Stretch — would add a `TaskSuggestionPort` in `task-board`.)
2. **Persistence of generated drafts**: keep the blueprint ephemeral (current plan) vs. saving drafts for reuse?
3. **Confidence/regeneration**: allow the user to "try again" (regenerate) — trivially supported since the endpoint is stateless.
4. **Provider & cost controls**: default model, max stages, and per-IP/per-user rate limits to cap spend?