# 03 - Module Architecture (DDD + SOLID)

## Why DDD Over Layered Modules?

| Approach | Structure | Problem |
|----------|-----------|---------|
| **Layered Modules** (current) | `projects/`, `stages/`, `tasks/` each with controller/service/repository | Business logic leaks across modules. Moving a task requires touching task service + stage service + project service. |
| **DDD Bounded Contexts** | `project-management/`, `task-board/` grouping related entities by domain | Business rules live together. A "task move" is one operation inside the task-board context. |

**DDD wins here** because your domain has clear business boundaries — a Project owns a Pipeline, a Pipeline owns Stages, a Task moves through Stages. These are **aggregate boundaries**, not technical layers.

---

## DDD Building Blocks

| Building Block | What It Is | Example in This System |
|----------------|-----------|----------------------|
| **Aggregate** | A cluster of entities treated as a single unit for data changes | `Project` aggregate (owns Pipeline, Stages, Tasks) |
| **Aggregate Root** | The only entry point to modify an aggregate | `Project` (you can't modify a Stage without going through its Project) |
| **Entity** | An object with identity that persists | `Task`, `TaskComment`, `User` |
| **Value Object** | An immutable object without identity (describes something) | `TaskPriority`, `StageColor`, `Position` |
| **Domain Event** | Something that happened in the domain | `TaskMoved`, `TaskAssigned`, `ProjectCreated` |
| **Repository** | Abstracts persistence for an aggregate | `ProjectRepository`, `TaskRepository` |
| **Domain Service** | Business logic that doesn't belong to a single entity | `TaskMoveService` (coordinates Stage + Task position changes) |
| **Read Model** | A query-side projection optimized for reads/reporting | `DashboardReport`, `VelocityReport`, `TasksByStage` |

---

## Bounded Contexts

```
src/
├── common/                        (shared infrastructure)
│   ├── middleware/
│   ├── errors/
│   ├── events/
│   └── ...
├── contexts/
│   ├── project-management/        ★ BOUNDED CONTEXT 1
│   │   ├── domain/                — Entities, Value Objects, Aggregate Root
│   │   │   ├── project.entity.ts
│   │   │   ├── pipeline.entity.ts
│   │   │   ├── stage.entity.ts
│   │   │   ├── stage-color.value-object.ts
│   │   │   └── stage-position.value-object.ts
│   │   ├── application/           — Use cases (Application Services)
│   │   │   ├── create-project.use-case.ts
│   │   │   ├── get-project.use-case.ts
│   │   │   ├── list-projects.use-case.ts
│   │   │   ├── update-project.use-case.ts
│   │   │   ├── delete-project.use-case.ts
│   │   │   ├── add-stage.use-case.ts
│   │   │   ├── update-stage.use-case.ts
│   │   │   ├── reorder-stage.use-case.ts
│   │   │   └── delete-stage.use-case.ts
│   │   ├── infrastructure/        — Prisma implementation
│   │   │   ├── prisma/
│   │   │   │   └── project.repository.ts
│   │   │   └── prisma/
│   │   │       └── stage.repository.ts
│   │   ├── interfaces/            — HTTP layer (Controller + Validator + Resource)
│   │   │   ├── project.controller.ts
│   │   │   ├── project.validator.ts
│   │   │   ├── project.resource.ts
│   │   │   └── project.routes.ts
│   │   └── project-management.context.ts  — Wires everything together
│   │
│   └── task-board/                ★ BOUNDED CONTEXT 2
│       ├── domain/
│       │   ├── task.entity.ts
│       │   ├── task-assignment.entity.ts
│       │   ├── task-comment.entity.ts
│       │   ├── task-attachment.entity.ts
│       │   ├── task-priority.value-object.ts
│       │   ├── task-position.value-object.ts
│       │   └── task.events.ts       — Domain events (TaskMoved, TaskAssigned)
│       ├── application/
│       │   ├── create-task.use-case.ts
│       │   ├── get-task.use-case.ts
│       │   ├── list-tasks.use-case.ts
│       │   ├── update-task.use-case.ts
│       │   ├── delete-task.use-case.ts
│       │   ├── move-task.use-case.ts        — Coordinates Task + Stage position
│       │   ├── reorder-task.use-case.ts
│       │   ├── assign-task.use-case.ts
│       │   ├── unassign-task.use-case.ts
│       │   ├── add-comment.use-case.ts
│       │   └── delete-comment.use-case.ts
│       ├── infrastructure/
│       │   ├── prisma/
│       │   │   ├── task.repository.ts
│       │   │   ├── task-assignment.repository.ts
│       │   │   └── task-comment.repository.ts
│       │   └── queue/
│       │       └── task-event-publisher.ts
│       ├── interfaces/
│       │   ├── task.controller.ts
│       │   ├── task.validator.ts
│       │   ├── task.resource.ts
│       │   └── task.routes.ts
│       └── task-board.context.ts
│
│   └── reports/                 ★ BOUNDED CONTEXT 3
│       ├── domain/              — Read Models & Query contracts (no writes)
│       │   ├── dashboard-report.read-model.ts
│       │   ├── tasks-by-stage.read-model.ts
│       │   ├── tasks-by-priority.read-model.ts
│       │   ├── velocity.read-model.ts
│       │   ├── task-aging.read-model.ts
│       │   ├── workload.read-model.ts
│       │   └── time-range.value-object.ts
│       ├── application/         — Report/query use cases (read-only)
│       │   ├── get-user-summary.use-case.ts
│       │   ├── get-user-tasks-by-stage.use-case.ts
│       │   ├── get-user-tasks-by-priority.use-case.ts
│       │   ├── get-user-velocity.use-case.ts
│       │   ├── get-user-overdue.use-case.ts
│       │   ├── get-user-upcoming.use-case.ts
│       │   ├── get-user-workload.use-case.ts
│       │   ├── get-project-summary.use-case.ts
│       │   ├── get-project-tasks-by-stage.use-case.ts
│       │   ├── get-project-tasks-by-priority.use-case.ts
│       │   ├── get-project-velocity.use-case.ts
│       │   ├── get-project-aging.use-case.ts
│       │   ├── get-project-workload.use-case.ts
│       │   └── get-project-assignee-activity.use-case.ts
│       ├── infrastructure/
│       │   ├── prisma/
│       │   │   ├── report.repository.ts        — SQL aggregations over Task/TaskAssignment
│       │   │   └── report-projection.repository.ts — (optional) materialized snapshot reads
│       │   └── cache/
│       │       └── report-cache.service.ts     — Redis cache for expensive dashboard queries
│       ├── interfaces/
│       │   ├── report.controller.ts
│       │   ├── report.validator.ts
│       │   ├── report.resource.ts
│       │   └── report.routes.ts
│       └── reports.context.ts
```

---

## Layer Responsibilities (DDD Style)

### domain/ — The Core (No Framework Dependencies)

```typescript
// domain/project.entity.ts
export class Project {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string | null,
    public readonly ownerId: string,
    public readonly pipeline: Pipeline,
    public readonly createdAt: Date,
  ) {}

  // Business rules live HERE, not in a service
  addStage(name: string, color?: string): Stage {
    if (this.pipeline.stages.length >= 20) {
      throw new AppError(400, 'Pipeline cannot exceed 20 stages', 'STAGE_LIMIT_REACHED');
    }
    return this.pipeline.addStage(name, color);
  }

  removeStage(stageId: string): void {
    if (this.pipeline.stages.length <= 1) {
      throw new AppError(400, 'Cannot delete the last stage', 'LAST_STAGE');
    }
    this.pipeline.removeStage(stageId);
  }
}
```

```typescript
// domain/task.entity.ts
export class Task {
  constructor(
    public readonly id: string,
    public title: string,
    public description: string | null,
    public readonly projectId: string,
    public stageId: string | null,
    public position: number,
    public priority: TaskPriority,
    public dueDate: Date | null,
    public readonly creatorId: string,
  ) {}

  // Domain event raised when task moves
  moveTo(targetStageId: string, targetPosition: number): TaskMovedEvent {
    const fromStageId = this.stageId;
    this.stageId = targetStageId;
    this.position = targetPosition;

    return new TaskMovedEvent({
      taskId: this.id,
      fromStageId,
      toStageId: targetStageId,
    });
  }
}
```

### application/ — Use Cases (Orchestration Only)

```typescript
// application/move-task.use-case.ts
export class MoveTaskUseCase {
  constructor(
    private taskRepo: TaskRepository,
    private stageRepo: StageRepository,
    private eventPublisher: TaskEventPublisher,
  ) {}

  async execute(input: MoveTaskInput): Promise<TaskResponse> {
    // 1. Load aggregates
    const task = await this.taskRepo.findById(input.taskId);
    if (!task) throw new NotFoundError('Task not found', 'TASK_NOT_FOUND');

    const targetStage = await this.stageRepo.findById(input.targetStageId);
    if (!targetStage) throw new NotFoundError('Stage not found', 'STAGE_NOT_FOUND');

    // 2. Execute domain logic (returns domain event)
    const event = task.moveTo(input.targetStageId, input.targetPosition);

    // 3. Persist
    await this.taskRepo.save(task);

    // 4. Publish event (notification, activity log, etc.)
    await this.eventPublisher.publish(event);

    return task;
  }
}
```

### infrastructure/ — Prisma Implementation

```typescript
// infrastructure/prisma/task.repository.ts
import { prisma } from '@db/client';
import { Task } from '../domain/task.entity';

export class PrismaTaskRepository implements TaskRepository {
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

  // Maps Prisma row → Domain entity
  private toDomain(raw: any): Task {
    return new Task(raw.id, raw.title, raw.description, raw.projectId, ...);
  }
}
```

### interfaces/ — HTTP Layer (Thin)

```typescript
// interfaces/task.controller.ts
export const taskController = {
  move: asyncHandler(async (req, res) => {
    const result = await moveTaskUseCase.execute({
      taskId: req.params.id,
      targetStageId: req.body.targetStageId,
      targetPosition: req.body.targetPosition,
    });

    res.status(200).json({
      success: true,
      message: 'Task moved successfully',
      data: taskResource.detail(result),
    });
  }),
};
```

---

## Aggregate Boundaries Diagram

```
┌─────────────────────────────────────────────────────┐
│                Project Management                    │
│                                                     │
│  Project (Aggregate Root)                           │
│  ├── Pipeline (Value Object — owned by Project)     │
│  │   └── Stage[] (Entities — ordered by position)   │
│  └── Tasks[] (reference only — belongs to TaskBoard)│
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
│                 Reports & Analytics                  │
│                                                     │
│  (Read-Model / Query context — NO aggregate writes) │
│                                                     │
│  Reads from Task + TaskAssignment + Stage tables     │
│  Builds projections:                                │
│   - Distribution by stage / priority                │
│   - Velocity & throughput over time                 │
│   - Task aging & overdue trends                     │
│   - Team workload by assignee                       │
│                                                     │
│  Optionally cached in Redis / snapshot table        │
└─────────────────────────────────────────────────────┘
```

---

## Cross-Context Communication

When a task moves between stages, the Task Board context publishes a `TaskMovedEvent`. The Project Management context consumes it to update activity logs or trigger notifications.

```typescript
// Domain Event (shared contract)
interface TaskMovedEvent {
  taskId: string;
  taskTitle: string;
  projectId: string;
  fromStageId: string | null;
  toStageId: string;
  movedById: string;
  occurredAt: Date;
}

// Published via RabbitMQ (existing infrastructure)
// Consumed by notification worker + Reports projection updater
```

---

## Reports Context — Caching & Performance

Dashboards aggregate data across many tasks. To keep them fast without hammering the main task tables:

| Strategy | When To Use | Mechanism |
|----------|-------------|-----------|
| **Direct SQL `GROUP BY`** | Small-to-medium datasets (default) | Prisma query / raw `pg` aggregate queries |
| **Redis Cache** | Frequently-hit dashboards with stable ranges | Cache JSON report by `(userId, projectId, range, filters)` with TTL (e.g. 5 min) |
| **Materialized Snapshot Table** | Large datasets / heavy velocity queries | Worker refreshes `TaskSnapshot` from `TaskMoved`/`TaskCompleted` events |

**Cache-aside pattern** (in `report-cache.service.ts`):
```
1. Check Redis for key = report:user:{id}:summary:week
2. On hit → return cached JSON
3. On miss  → run aggregation SQL, store in Redis, return
4. Invalidate on TaskMoved/TaskCompleted events (or rely on TTL)
```

> The Reports context stays **read-only**. It never issues write commands to the task/project aggregates — it only reads source tables and maintains its own derived projections.



| Principle | DDD Implementation |
|-----------|-------------------|
| **S**ingle Responsibility | Each Use Case does ONE thing. `MoveTaskUseCase` only moves tasks. |
| **O**pen/Closed | New use cases (e.g., `BulkMoveTaskUseCase`) extend without modifying existing ones. |
| **L**iskov Substitution | `TaskRepository` interface — swap `PrismaTaskRepository` for `InMemoryTaskRepository` in tests. |
| **I**nterface Segregation | Use Cases depend only on the repository methods they need, not the full repository. |
| **D**ependency Inversion | Use Cases depend on repository interfaces, not Prisma. Infrastructure implements the interfaces. |

---

## File Count Comparison

| Approach | New Files | Modified Files |
|----------|-----------|---------------|
| Layered Modules | 18 | 9 |
| **DDD Bounded Contexts** | **22** | **5** |

DDD creates more files but **fewer modifications to existing code** — the bounded contexts encapsulate changes cleanly.

---

## Validation & Resources (Kept in interfaces/)

Zod validators and response transformers stay in the `interfaces/` layer — they're HTTP-specific, not domain logic.

```typescript
// interfaces/project.validator.ts (unchanged from previous plan)
createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
  }),
});
```

---

## Migration Path (From Current Codebase)

1. Create `src/contexts/` directory structure
2. Move existing `src/modules/projects/` → `src/contexts/project-management/`
3. Move existing `src/modules/tasks/` → `src/contexts/task-board/`
4. Extract domain entities from service/repository files
5. Create Use Case files from service methods
6. Implement repository interfaces in infrastructure/
7. Update controllers to call Use Cases instead of services
8. Update route registration
