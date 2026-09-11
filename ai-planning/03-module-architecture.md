# 03 - Module Architecture (Modular Monolith + Clean/Hexagonal + DDD)

## The Architecture in One Sentence

A **Modular Monolith** with **Hexagonal (Ports & Adapters)** internals and **DDD** domain modelling — a single deployable process with strict internal boundaries.

---

## Why This Combination?

| Term | What It Means Here |
|------|-------------------|
| **Modular Monolith** | One deployment unit, but each domain module is self-contained with its own internal layers. Modules communicate only through public contracts (ports), never by reaching into each other's internals. |
| **Hexagonal (Ports & Adapters)** | The domain sits at the center. All I/O (database, HTTP, queues, workers) goes through **ports** (interfaces). Concrete implementations are **adapters** plugged in at the edges. |
| **DDD** | Aggregates, entities, value objects, domain events model the business domain. Domain logic lives in entities, not services. |
| **Clean Architecture** | Per-module layers (`domain` → `application` → `interfaces` → `infrastructure`) organize dependencies so they all **point inward**. Each module obeys the Dependency Rule; the outer layers are swappable frameworks.

These three reinforce each other. The monolith gives you simplicity and transaction safety; hexagonal architecture keeps the edges swappable; DDD keeps the domain truthful.

---

## The Hexagon (Per Module)

```
                      ┌──────────────────────────────┐
                      │        INTERFACES             │
                      │   (Driving / Primary Adapters)│
                      │                               │
                      │  HTTP Controllers / Routes    │
                      │  Queue Consumers              │
                      │  CLI Commands                 │
                      └──────────┬───────────────────┘
                                 │ calls
                      ┌──────────▼───────────────────┐
                      │       APPLICATION             │
                      │     (Use Cases / Commands)    │
                      │                               │
                      │  orchestrate domain + ports   │
                      └──────────┬───────────────────┘
                                 │ depends on
                    ┌────────────▼────────────────────┐
                    │           DOMAIN                │
                    │       (Core Business Logic)     │
                    │                                 │
                    │  Entities / Value Objects        │
                    │  Domain Events                  │
                    │  PORTS (interfaces for I/O)     │
                    └────────────┬────────────────────┘
                                 │ implemented by
                      ┌──────────▼───────────────────┐
                      │      INFRASTRUCTURE           │
                      │   (Driven / Secondary Adapters)│
                      │                               │
                      │  Prisma Repository impls      │
                      │  RabbitMQ Event Publisher     │
                      │  Redis Cache                  │
                      │  Email Sender                 │
                      │  S3 / Local File Storage      │
                      └──────────────────────────────┘
```

**The Dependency Rule**: Arrows point inward only. Domain depends on nothing. Application depends on Domain. Infrastructure depends on Domain (implements its ports). Interfaces depends on Application.

### Clean Architecture Layer Mapping (Per Module)

Each module's folders map directly onto Clean Architecture's four layers. Dependencies point strictly inward, and this is enforced at **import level** (ESLint `import/no-restricted-paths` or the `boundaries` plugin can codify it):

| Clean Architecture Layer | Folder | Contents | May Depend On |
|--------------------------|--------|----------|---------------|
| **Enterprise / Core Business Rules** | `domain/` | Entities, Value Objects, Domain Events, Ports (interfaces) | **Nothing** — pure TS, no Prisma, no Express |
| **Application Business Rules** | `application/` | Use cases orchestrate domain objects + ports | `domain/` only |
| **Interface Adapters** | `interfaces/` | Controllers, validators, resource/DTO mappers (driving adapters) | `application/` (+ `domain/` for DTO mapping) |
| **Frameworks & Drivers** | `infrastructure/` | Prisma repositories, message-bus publishers, cross-module gateways (driven adapters) | `domain/` (implements its ports); never other modules' internals |

Knock-on rules that keep the layers honest:

1. **Domain never imports Prisma.** The Prisma `TaskPriority` enum is a persistence artifact. Domain defines its own `TaskPriority` union; repository adapters map between them (see the mapper in the adapter example below).
2. **Application never imports Express, Prisma, or RabbitMQ.** It talks only to ports.
3. **Infrastructure never imports another module's internals.** Cross-module reads go through **consumer-owned query ports** implemented as *gateways* in the consumer module (see "Cross-Module Communication Patterns").
4. **`interfaces/` is the only place that sees HTTP.** Controllers map HTTP in/out to use-case inputs and DTOs; request validation lives in validators.
5. **External AI/LLM providers are driven adapters, just like Prisma or RabbitMQ.** They implement a domain port (`ProjectBlueprintGeneratorPort`) in `infrastructure/ai/` via a shared `common/llm` client. Application never imports an OpenAI/Anthropic SDK — see `06-ai-project-blueprint.md`.

---

## Module Structure (Full File Tree)

```
src/
├── common/                            SHARED INFRASTRUCTURE
│   ├── middleware/                     — Express middleware (auth, validate, upload, rate-limit)
│   ├── errors/                        — AppError, NotFoundError, ValidationError
│   ├── events/                        — shared RabbitMQ message-bus adapter (implements each module's event-publisher PORT)
│   ├── storage/                       — Storage port + S3/Local adapters (existing)
│   ├── cache/                         — Cache port + Redis adapter
│   ├── mail/                          — Email port + Nodemailer adapter (existing)
│   ├── queue/                         — Queue port + RabbitMQ adapter (existing)
│   ├── llm/                           — shared LLM client (provider interface + OpenAI adapter, used only by adapters)
│   ├── types/                         — ApiResponse, shared DTOs
│   ├── utils/                         — asyncHandler, prisma util
│   ├── openapi/                       — Swagger/OpenAPI setup (existing)
│   └── declarations/                  — Express type augmentation (existing)
│
├── modules/
│   │
│   ├── project-management/            MODULE 1: Projects + Stages
│   │   │
│   │   ├── domain/                    CORE — zero dependencies
│   │   │   ├── entities/
│   │   │   │   ├── project.entity.ts
│   │   │   │   └── stage.entity.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── stage-color.vo.ts
│   │   │   │   ├── stage-position.vo.ts
│   │   │   │   ├── stage-is-done.vo.ts
│   │   │   │   ├── project-blueprint.vo.ts      (AI proposal — transient, never persisted)
│   │   │   │   └── stage-draft.vo.ts
│   │   │   ├── events/
│   │   │   │   ├── project-created.event.ts
│   │   │   │   └── stage-reordered.event.ts
│   │   │   └── ports/                INTERFACES (no implementations here)
│   │   │       ├── project.repository.port.ts
│   │   │       ├── stage.repository.port.ts
│   │   │       ├── project-event-publisher.port.ts
│   │   │       └── project-blueprint-generator.port.ts
│   │   │
│   │   ├── application/              USE CASES — depends only on domain/
│   │   │   ├── create-project.use-case.ts
│   │   │   ├── generate-project-blueprint.use-case.ts   (AI — calls BlueprintGeneratorPort)
│   │   │   ├── get-project.use-case.ts
│   │   │   ├── list-projects.use-case.ts
│   │   │   ├── update-project.use-case.ts
│   │   │   ├── delete-project.use-case.ts
│   │   │   ├── add-stage.use-case.ts
│   │   │   ├── update-stage.use-case.ts
│   │   │   ├── reorder-stage.use-case.ts
│   │   │   └── delete-stage.use-case.ts
│   │   │
│   │   ├── infrastructure/           ADAPTERS — implements domain ports
│   │   │   ├── persistence/
│   │   │   │   ├── prisma-project.repository.ts
│   │   │   │   └── prisma-stage.repository.ts
│   │   │   └── ai/
│   │   │       └── openai-blueprint-generator.adapter.ts   (only file that knows the LLM)
│   │   │
│   │   ├── interfaces/               DRIVING ADAPTERS
│   │   │   ├── http/
│   │   │   │   ├── project.controller.ts
│   │   │   │   ├── project.validator.ts
│   │   │   │   ├── project.resource.ts
│   │   │   │   └── project.routes.ts
│   │   │   └── queue/
│   │   │       └── stage-reordered.consumer.ts  (future)
│   │   │
│   │   ├── index.ts                  MODULE BARREL (public API)
│   │   │   exports: { ProjectModule }
│   │   │
│   │   └── __tests__/                TESTS colocated with module
│   │       ├── project.entity.test.ts
│   │       ├── create-project.use-case.test.ts
│   │       └── project.controller.test.ts
│   │
│   │
│   ├── task-board/                   MODULE 2: Tasks, Assignments, Comments
│   │   │
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── task.entity.ts
│   │   │   │   ├── task-assignment.entity.ts
│   │   │   │   ├── task-comment.entity.ts
│   │   │   │   └── task-attachment.entity.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── task-priority.vo.ts
│   │   │   │   └── task-position.vo.ts
│   │   │   ├── events/
│   │   │   │   ├── task-moved.event.ts
│   │   │   │   ├── task-assigned.event.ts
│   │   │   │   └── task-completed.event.ts
│   │   │   └── ports/
│   │   │       ├── task.repository.port.ts
│   │   │       ├── task-assignment.repository.port.ts
│   │   │       ├── task-comment.repository.port.ts
│   │   │       ├── task-event-publisher.port.ts
│   │   │       ├── project-query.port.ts     (consumer-owned → implemented as a gateway)
│   │   │       ├── stage-query.port.ts        (consumer-owned → implemented as a gateway)
│   │   │       └── user-query.port.ts         (consumer-owned → implemented as a gateway)
│   │   │
│   │   ├── application/
│   │   │   ├── create-task.use-case.ts
│   │   │   ├── get-task.use-case.ts
│   │   │   ├── list-tasks.use-case.ts
│   │   │   ├── update-task.use-case.ts
│   │   │   ├── delete-task.use-case.ts
│   │   │   ├── move-task.use-case.ts
│   │   │   ├── reorder-task.use-case.ts
│   │   │   ├── assign-task.use-case.ts
│   │   │   ├── unassign-task.use-case.ts
│   │   │   ├── add-comment.use-case.ts
│   │   │   └── delete-comment.use-case.ts
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   ├── prisma-task.repository.ts
│   │   │   │   ├── prisma-task-assignment.repository.ts
│   │   │   │   └── prisma-task-comment.repository.ts
│   │   │   ├── events/
│   │   │   │   └── task-event-publisher.adapter.ts
│   │   │   └── gateways/            CROSS-MODULE adapters (consumer-owned)
│   │   │       ├── project-query.gateway.ts    → project-management barrel
│   │   │       ├── stage-query.gateway.ts       → project-management barrel
│   │   │       └── user-query.gateway.ts        → auth barrel
│   │   │
│   │   ├── interfaces/
│   │   │   ├── http/
│   │   │   │   ├── task.controller.ts
│   │   │   │   ├── task.validator.ts
│   │   │   │   ├── task.resource.ts
│   │   │   │   └── task.routes.ts
│   │   │   └── queue/
│   │   │       └── task-moved.consumer.ts  (future)
│   │   │
│   │   ├── index.ts
│   │   └── __tests__/
│   │
│   │
│   ├── reports/                      MODULE 3: Dashboard & Analytics (Read-only)
│   │   │
│   │   ├── domain/
│   │   │   ├── read-models/
│   │   │   │   ├── dashboard-summary.rm.ts
│   │   │   │   ├── tasks-by-stage.rm.ts
│   │   │   │   ├── tasks-by-priority.rm.ts
│   │   │   │   ├── velocity.rm.ts
│   │   │   │   ├── task-aging.rm.ts
│   │   │   │   └── workload.rm.ts
│   │   │   ├── value-objects/
│   │   │   │   └── time-range.vo.ts
│   │   │   └── ports/
│   │   │       ├── report-query.port.ts
│   │   │       └── project-query.port.ts     (consumer-owned → implemented as a gateway)
│   │   │
│   │   ├── application/
│   │   │   ├── get-user-summary.use-case.ts
│   │   │   ├── get-user-tasks-by-stage.use-case.ts
│   │   │   ├── get-user-tasks-by-priority.use-case.ts
│   │   │   ├── get-user-velocity.use-case.ts
│   │   │   ├── get-user-overdue.use-case.ts
│   │   │   ├── get-user-upcoming.use-case.ts
│   │   │   ├── get-user-workload.use-case.ts
│   │   │   ├── get-project-summary.use-case.ts
│   │   │   ├── get-project-tasks-by-stage.use-case.ts
│   │   │   ├── get-project-tasks-by-priority.use-case.ts
│   │   │   ├── get-project-velocity.use-case.ts
│   │   │   ├── get-project-aging.use-case.ts
│   │   │   ├── get-project-workload.use-case.ts
│   │   │   └── get-project-assignee-activity.use-case.ts
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   └── prisma-report-query.adapter.ts
│   │   │   ├── cache/
│   │   │   │   └── report-cache.adapter.ts
│   │   │   └── gateways/
│   │   │       └── project-query.gateway.ts  → project-management barrel
│   │   │
│   │   ├── interfaces/
│   │   │   └── http/
│   │   │       ├── report.controller.ts
│   │   │       ├── report.validator.ts
│   │   │       ├── report.resource.ts
│   │   │       └── report.routes.ts
│   │   │
│   │   ├── index.ts
│   │   └── __tests__/
│   │
│   │
│   └── auth/                         MODULE 4: Auth (existing — refactor)
│       ├── domain/                    (keep as-is or extract JWT util here)
│       ├── application/               (login, register use cases)
│       ├── infrastructure/            (JWT adapter, bcrypt adapter)
│       ├── interfaces/                (auth.controller, auth.routes)
│       └── index.ts
│
├── common/
│   └── di/                           COMPOSITION ROOT (wires everything)
│       ├── container.ts              — instantiate adapters, inject into use cases
│       ├── modules.ts                — register module routes
│       └── events.ts                 — wire event publishers to consumers
│
├── prisma/
│   └── client.ts                     (existing)
│
└── app.ts                            (existing — updated to use module barrel)
```

---

## Ports & Adapters in Practice

### Port (Interface in Domain Layer)

```typescript
// modules/task-board/domain/ports/task.repository.port.ts
export interface TaskRepositoryPort {
  findById(id: string): Promise<Task | null>;
  save(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
  listByStage(projectId: string, stageId: string): Promise<Task[]>;
}
```

```typescript
// modules/task-board/domain/ports/task-event-publisher.port.ts
export interface TaskEventPublisherPort {
  publish(event: DomainEvent): Promise<void>;
}
```

### Adapter (Infrastructure Layer)

```typescript
// modules/task-board/infrastructure/persistence/prisma-task.repository.ts
import { prisma } from '@db/client';
import { Task } from '../../domain/entities/task.entity';
import { TaskRepositoryPort } from '../../domain/ports/task.repository.port';

export class PrismaTaskRepository implements TaskRepositoryPort {
  async findById(id: string): Promise<Task | null> {
    const raw = await prisma.task.findUnique({ where: { id } });
    return raw ? this.toDomain(raw) : null;
  }

  async save(task: Task): Promise<void> {
    await prisma.task.update({
      where: { id: task.id },
      data: { stageId: task.stageId, position: task.position },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.task.delete({ where: { id } });
  }

  async listByStage(projectId: string, stageId: string): Promise<Task[]> {
    const raws = await prisma.task.findMany({
      where: { projectId, stageId },
      orderBy: { position: 'asc' },
    });
    return raws.map(this.toDomain);
  }

  // Domain owns its TaskPriority union — Prisma enums are mapped here, at the edges.
  private toDomain(raw: any): Task {
    return new Task(
      raw.id, raw.title, raw.description, raw.projectId,
      raw.stageId, raw.position,
      mapPriorityToDomain(raw.priority), // Prisma enum → domain union
      raw.dueDate, raw.creatorId,
    );
  }
}

// Prisma enums and record shapes must NEVER cross into domain/. Every adapter
// maps raw → domain (toDomain) and domain → raw (toPersistence). The domain
// defines its own union/enum types so it compiles without Prisma.
```

### Use Case (Application Layer) — depends only on Port

```typescript
// modules/task-board/application/move-task.use-case.ts
import { TaskRepositoryPort } from '../domain/ports/task.repository.port';
import { TaskEventPublisherPort } from '../domain/ports/task-event-publisher.port';

export class MoveTaskUseCase {
  constructor(
    private readonly taskRepo: TaskRepositoryPort,           // injected via DI
    private readonly eventPublisher: TaskEventPublisherPort, // injected via DI
  ) {}

  async execute(input: { taskId: string; targetStageId: string; targetPosition: number }) {
    const task = await this.taskRepo.findById(input.taskId);
    if (!task) throw new NotFoundError('Task not found', 'TASK_NOT_FOUND');

    const event = task.moveTo(input.targetStageId, input.targetPosition);

    await this.taskRepo.save(task);
    await this.eventPublisher.publish(event);

    return task;
  }
}
```

### Composition Root (Wiring)

```typescript
// src/common/di/container.ts
import { PrismaTaskRepository } from '@modules/task-board/infrastructure/persistence/prisma-task.repository';
import { RabbitMQTaskEventPublisher } from '@modules/task-board/infrastructure/events/task-event-publisher.adapter';
import { MoveTaskUseCase } from '@modules/task-board/application/move-task.use-case';

// Instantiate adapters (singletons)
const taskRepo = new PrismaTaskRepository();
const taskEventPublisher = new RabbitMQTaskEventPublisher();

// Inject into use cases
export const moveTaskUseCase = new MoveTaskUseCase(taskRepo, taskEventPublisher);
```

---

## Enforcing Module Boundaries

In a Modular Monolith, the **dependency rule is enforced at import level**:

| Rule | Enforcement |
|------|-------------|
| **Modules cannot import other modules' internals** | A `task-board` use case can never `import { prisma } from '@db/client'` directly — it uses `TaskRepositoryPort` |
| **Modules cannot import other modules' infrastructure** | `task-board` cannot import `prisma-project.repository.ts` |
| **Modules communicate only through ports and events** | If `task-board` needs project data, it defines a `ProjectQueryPort` in its domain, implemented as a **gateway** in `task-board/infrastructure/gateways/` that delegates to `project-management`'s barrel (one-way dependency — never cyclic) |
| **Composition root is the only place that knows all adapters** | `container.ts` imports all adapters from all modules |

### Cross-Module Communication Patterns

```
┌─────────────────┐        Port (ProjectQueryPort)        ┌─────────────────────┐
│   task-board     │ ───────────────────────────────────▶ │ project-management   │
│   (use case)     │                                       │ (adapter implements) │
└─────────────────┘                                        └─────────────────────┘

┌─────────────────┐        Domain Event                   ┌─────────────────────┐
│   task-board     │ ──────── RabbitMQ ──────────────────▶ │   reports           │
│   (publisher)    │                                       │   (consumer)        │
└─────────────────┘                                        └─────────────────────┘
```

For **synchronous** cross-module reads (e.g., task-board needs to check "does this stage exist?"):
- Define the port in the **consumer** module's `domain/ports/` (e.g., `StageQueryPort` in `task-board`)
- Implement it as a **gateway** in the *same* module's `infrastructure/gateways/` that delegates to the provider module's **public barrel** (`project-management/index.ts`)
- Wire it in the composition root

```typescript
// task-board/domain/ports/stage-query.port.ts
export interface StageQueryPort {
  existsById(stageId: string, projectId: string): Promise<boolean>;
  findById(stageId: string): Promise<StageReadModel | null>;
}
```

```typescript
// task-board/infrastructure/gateways/stage-query.gateway.ts
// Consumer-owned adapter: implements StageQueryPort by calling project-management's public API.
import { projectManagement } from '@modules/project-management';

export class StageQueryGateway implements StageQueryPort {
  async existsById(stageId: string, projectId: string): Promise<boolean> {
    return projectManagement.stageQueries.existsById(stageId, projectId);
  }
}
```

The gateway keeps the module dependency **one-way** (`task-board` → `project-management`). Never place the gateway in the provider module — the provider would then import the consumer's port type, and the module dependency graph could become cyclic.

For **asynchronous** cross-module communication:
- Use domain events via RabbitMQ (existing infrastructure)

---

## Module Public API (Barrel Exports)

Each module exposes only what other modules (or the main app) can use. Nothing else is accessible.

```typescript
// modules/project-management/index.ts
export { projectModuleRoutes } from './interfaces/http/project.routes';
export { ProjectModule } from './project-management.module';
```

```typescript
// modules/task-board/index.ts
export { taskModuleRoutes } from './interfaces/http/task.routes';
export { TaskModule } from './task-board.module';
```

> **Cross-module access rule**: module A may **only** import `@modules/b` (its barrel `index.ts`). Barrels export routes, the module class, and the *public query facades* that other modules' gateways call. A consumer's gateway never imports `b/infrastructure/...` or `b/domain/...` directly — only the provider's barrel.

---

## SOLID in This Architecture

| Principle | Implementation |
|-----------|---------------|
| **S**ingle Responsibility | Each Use Case does ONE thing. Each module owns ONE domain concept. |
| **O**pen/Closed | New use cases or adapters extend without modifying existing code. Add a new adapter = new class implementing an existing port. |
| **L**iskov Substitution | `TaskRepositoryPort` can be swapped: `PrismaTaskRepository` in prod, `InMemoryTaskRepository` in tests. |
| **I**nterface Segregation | Ports are narrow. `TaskRepositoryPort` has only the methods the task-board module needs. |
| **D**ependency Inversion | Domain defines ports. Infrastructure implements them. Use cases depend on ports, never on concrete classes. |

---

## Migration Path (From Current Codebase)

1. Create `src/modules/` directory structure
2. Move `src/modules/tasks/` → `src/modules/task-board/` with new internal layers
3. Extract `TaskRepositoryPort` from existing `task.repository.ts`
4. Move existing repository to `infrastructure/persistence/`
5. Create `src/common/di/container.ts` (composition root)
6. Move `src/modules/projects/` → `src/modules/project-management/`
7. Create new `src/modules/reports/` module
8. Refactor controllers to call use cases from the composition root
9. Update `src/app.ts` and `src/routes/index.ts` to use module barrel exports

---

## File Count vs. Previous Plan

| Layer | Files |
|-------|-------|
| domain/ (entities, VOs, events, ports) | ~21 |
| application/ (use cases) | ~21 |
| infrastructure/ (adapters + cross-module gateways) | ~14 |
| interfaces/ (HTTP + queue consumers) | ~12 |
| di/ (composition root) | 3 |
| __tests__/ | colocated |
| **Total new files** | **~71** |
