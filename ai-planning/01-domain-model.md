# 01 - Domain Model (DDD Style)

## Vision

A multi-tenant task management system where:

- Each **User** owns one or more **Projects**
- Each **Project** has an ordered list of **Stages** (columns) — ClickUp-style, no separate Pipeline entity
- **Tasks** live inside a Stage and can be dragged/reordered/moved between Stages
- Everything is exposed as REST APIs with full CRUD + drag-and-drop support

## What "Workflow" Means Here (ClickUp Mapping)

ClickUp uses the term **"Workflow"** to mean *the collection of Statuses a task can be in* — **not** a separate database entity. There is no `Workflow` table. The workflow is simply the ordered set of Statuses/columns configured on a List.

| ClickUp | Our Plan |
|---------|----------|
| List | `Project` |
| Status (the column on the board) | `Stage` |
| "Workflow" (the ordered collection of statuses) | The ordered `Stage[]` owned by the `Project` — **no separate table** |

> **Consequence**: In our plan, `Stage` plays the role of both the *column* and the *task's status*. When someone says "build a workflow," it means **adding/reordering `Stage`s on a `Project`** — covered by the `AddStageUseCase` and `ReorderStageUseCase`. There is deliberately **no `Workflow`/`Pipeline` entity** (ClickUp-style), keeping the model simple.

## Bounded Contexts

| Context | Responsibility | Aggregates |
|---------|---------------|------------|
| **Project Management** | Project lifecycle, Stage (column) management | `Project` (root), `Stage` |
| **Task Board** | Task lifecycle, Assignments, Comments, Attachments | `Task` (root), `TaskAssignment`, `TaskComment`, `TaskAttachment` |
| **Reports & Analytics** | User/project dashboards, metrics, charts over task/stage movement | `DashboardReport` (query model, read-only) |
| **User Management** | Authentication, User profiles | `User` (existing) |

## Aggregate Relationships

```
┌─────────────────────────────────────────────────────┐
│                Project Management                    │
│                                                     │
│  Project (Aggregate Root)  [ClickUp "List"]         │
│  ├── Stage[] (Entities — ordered by position)       │
│  │       [ClickUp "Status"/column]                  │
│  └── Tasks[] (reference only — belongs to TaskBoard)│
│                                                     │
│  NOTE: No separate Pipeline entity. Stages belong   │
│  directly to the Project (ClickUp-style).           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    Task Board                        │
│                                                     │
│  Task (Aggregate Root)                              │
│  ├── TaskAssignment[] (Entities)                    │
│  ├── TaskComment[] (Entities)                       │
│  └── TaskAttachment[] (Entities)                    │
│                                                     │
│  Note: Task references Stage by ID (not owned)      │
│  Cross-aggregate consistency via Domain Events       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                  Reports & Analytics                 │
│                                                     │
│  DashboardReport (Read Model - Query Only)          │
│  ├── TaskCountByStage[]                             │
│  ├── TaskCountByPriority[]                          │
│  ├── VelocityByDay[] / ByWeek[]                     │
│  ├── TaskTimeline / AgingReport                     │
│  └── TeamWorkload (by assignee)                     │
│                                                     │
│  Read-only projection built from domain events.     │
│  If needed: MaterializedView / Redis cache.         │
└─────────────────────────────────────────────────────┘
```

## ERD

```
User 1──N Project
Project 1──N Stage (ordered by position)
Project 1──N Task (pinned to a stage)
Stage 1──N Task
Task N──N User (via TaskAssignment for multi-assignee)
Task 1──N TaskAttachment
Task 1──N TaskComment
```

## Key Relationships

| Relation | Type | Notes |
|----------|------|-------|
| User → Project | 1:N | Creator / owner |
| Project → Stage | 1:N | Stages (columns) owned directly by the project — no pipeline (ClickUp-style) |
| Project → Task | 1:N | Tasks belong to a project (cross-aggregate reference) |
| Stage → Task | 1:N | Tasks are pinned to a stage (cross-aggregate reference) |
| Task → TaskAssignment | 1:N | Multi-assignee support (within Task aggregate) |
| Task → TaskComment | 1:N | Activity log / comments (within Task aggregate) |
| Task → TaskAttachment | 1:N | File attachments (within Task aggregate) |

## Domain Entities & Value Objects

### Project Management Context

| Type | Name | Description |
|------|------|-------------|
| **Aggregate Root** | `Project` | Owns Stage ordering (ClickUp List) |
| **Entity** | `Stage` | A column/status in the Kanban board (has identity, ordered) |
| **Value Object** | `StageColor` | Hex color for stage header (immutable) |
| **Value Object** | `StagePosition` | Ordered integer position (immutable wrapper). Gap-free sequencing is an **aggregate invariant** enforced by `Project.addStage()` / `Project.reorderStage()` — not by the VO itself |
| **Value Object** | `ProjectBlueprint` | AI/multi-step proposal: `{ name, description?, stages: StageDraft[] }`. **Transient** — never persisted; only the resulting `Project` + `Stage[]` are saved |
| **Value Object** | `StageDraft` | A single proposed column from a blueprint: `{ name, color?, isDone? }` |

### Task Board Context

| Type | Name | Description |
|------|------|-------------|
| **Aggregate Root** | `Task` | A work item that moves through stages |
| **Entity** | `TaskAssignment` | Links a User to a Task (multi-assignee) |
| **Entity** | `TaskComment` | A comment on a task |
| **Entity** | `TaskAttachment` | A file attached to a task |
| **Value Object** | `TaskPriority` | Priority level: LOW, MEDIUM, HIGH, URGENT |
| **Value Object** | `TaskPosition` | Position within a stage (for ordering) |

### Reports & Analytics Context

| Type | Name | Description |
|------|------|-------------|
| **Read Model** | `DashboardReport` | Aggregated metrics built from task data (no writes) |
| **Read Model** | `TaskCountByStage` | Number of tasks currently in each stage |
| **Read Model** | `TaskCountByPriority` | Number of tasks by priority level |
| **Read Model** | `VelocityByDate` | Tasks completed per day/week (throughput) |
| **Read Model** | `TaskAging` | Tasks grouped by age (overdue, due soon, on track) |
| **Read Model** | `TeamWorkload` | Tasks per assignee (open workload) |
| **View Object** | `TimeRange` | ISO date-range filter for report queries (day, week, month, custom) |

## Domain Events

| Event | Source Context | Consumer | Trigger |
|-------|---------------|----------|---------|
| `ProjectCreated` | Project Management | Reports | New project initialized with default stages |
| `TaskMoved` | Task Board | Reports, Notifications | Task moved between stages |
| `TaskAssigned` | Task Board | Notifications | User assigned to task |
| `StageReordered` | Project Management | Task Board | Project stages reordered |
| `TaskCompleted` | Task Board | Reports | Task reaches a terminal "Done" stage |

> **Note**: Reports is primarily a **query/read-model context**. It doesn't own entities or write commands. It builds projections by consuming domain events from Task Board and Project Management, or by querying task tables directly with read-only SQL.

## AI-Assisted Project Setup (Blueprint)

When a user wants a project fully set up for tasks without manually configuring columns, an **AI** generates a `ProjectBlueprint` — project name, description, and an ordered list of `StageDraft[]` (the workflow). See [06-ai-project-blueprint.md](06-ai-project-blueprint.md).

**Architectural note**: AI is an **external technology**, not a new bounded context. It sits behind the `ProjectBlueprintGeneratorPort` (in `project-management/domain/ports/`), implemented by an OpenAI/LLM adapter in `project-management/infrastructure/ai/`. The blueprint is a **transient value object** — nothing is persisted until the user confirms via `CreateProjectUseCase`, which validates the stages against the exact same `Project` invariants as manual stage management.

## Prisma Changes for Reports

Reports can be built via **direct SQL aggregation** over existing tables (no new tables needed for basic dashboards):

- `Task` table: `stageId`, `priority`, `dueDate`, `createdAt`, `updatedAt` → stage counts, priority counts, aging
- `TaskAssignment` table: `userId`, `assignedAt` → team workload
- `Stage` table: `position`, `name` → labels/ordering

**Optional** — if you want lightweight, high-performance dashboards without hitting the main tables each time, add a materialized projection table:

```prisma
model TaskSnapshot {
  id        String    @id @default(uuid())
  taskId    String
  projectId String
  stageId   String?
  priority  TaskPriority
  dueDate   DateTime?
  createdAt DateTime
  completedAt DateTime?
  updatedAt DateTime @updatedAt

  @@index([projectId, stageId])
  @@index([projectId, priority])
  @@index([projectId, createdAt])
  @@index([projectId, completedAt])
}
```

Populated/refreshed by a worker consuming `TaskMoved`, `TaskCompleted`, `TaskCreated` events.

## Prisma Schema

### Project Management Context

```prisma
model Project {
  id          String   @id @default(uuid())
  name        String
  description String?  @db.Text
  ownerId     String
  owner       User     @relation("ProjectOwner", fields: [ownerId], references: [id])
  stages      Stage[]
  tasks       Task[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId])
}

model Stage {
  id        String  @id @default(uuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  position  Int
  color     String? @default("#6366f1")
  isDone    Boolean @default(false)
  tasks     Task[]

  @@unique([projectId, position])
  @@index([projectId])
}
```

> **Note**: `Stage` now belongs directly to `Project` (ClickUp-style, no `Pipeline` entity). `isDone` marks the terminal "Done" stage used by completion-rate and velocity reports.

### Task Board Context

```prisma
model Task {
  id           String           @id @default(uuid())
  title        String
  description  String?          @db.Text
  projectId    String
  project      Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stageId      String?
  stage        Stage?           @relation(fields: [stageId], references: [id], onDelete: SetNull)
  position     Int              @default(0)
  priority     TaskPriority     @default(MEDIUM)
  dueDate      DateTime?
  completedAt  DateTime?
  creatorId    String
  creator      User             @relation("TaskCreator", fields: [creatorId], references: [id])
  assignments  TaskAssignment[]
  comments     TaskComment[]
  attachments  TaskAttachment[]
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([projectId])
  @@index([stageId])
  @@index([creatorId])
}

model TaskAssignment {
  id         String   @id @default(uuid())
  taskId     String
  task       Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  assignedAt DateTime @default(now())

  @@unique([taskId, userId])
  @@index([userId])
}

model TaskComment {
  id        String   @id @default(uuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation("CommentAuthor", fields: [authorId], references: [id])
  content   String   @db.Text
  createdAt DateTime @default(now())

  @@index([taskId])
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

> **Prisma enums are a persistence concern.** The domain layer defines its own `TaskPriority` union type (mirroring the enum) and **never imports Prisma types**. Repository adapters map Prisma enum → domain union in `toDomain()` and reverse in `toPersistence()`. This keeps the core (`domain/` + `application/`) framework-free, so the domain still compiles if the DB technology changes.

### Existing Models to Update

- **User**: add `projects Project[]`, `assignments TaskAssignment[]`, `comments TaskComment[]`
- **TaskAttachment**: update `uploadedBy` relation to match new Task model
- **Task**: add `completedAt DateTime?` to track when a task reached a done stage (needed for velocity/throughput reports)
- Remove old `Task` model (replaced with the new one above)
- Remove old `TaskStatus` enum (replaced by stage position + priority)

## Migration Strategy

1. Create new models (`Project`, `Stage`, `TaskAssignment`, `TaskComment`)
2. Rename old `Task` → `LegacyTask` temporarily
3. Create new `Task` model
4. Migrate data from `LegacyTask` → `Task` (map old `TaskStatus` enum to default project stages)
5. Drop `LegacyTask` and old `TaskStatus` enum
