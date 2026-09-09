# 04 - Core Business Logic (DDD Use Cases)

## Use Case: Create Project

```
CreateProjectUseCase.execute(input)

  1. Create Project aggregate root
  2. Create Pipeline (value object) attached to Project
  3. Create 5 default Stages: ["Backlog", "To Do", "In Progress", "In Review", "Done"]
  4. Persist via ProjectRepository
  5. Raise ProjectCreatedEvent
  6. Return Project aggregate with Pipeline
```

**Boundary**: Project Management Context

## Use Case: Add Stage to Pipeline

```
AddStageUseCase.execute(projectId, input)

  1. Load Project aggregate (includes Pipeline)
  2. Project.addStage(name, color) — business rule: max 20 stages
  3. Persist via ProjectRepository
  4. Return updated Pipeline with new Stage
```

**Business Rules** (in Project entity):
- Maximum 20 stages per pipeline
- Stage position is auto-assigned (gap-free)
- Stage name must be unique within pipeline

## Use Case: Reorder Stage

```
ReorderStageUseCase.execute(projectId, stageId, newPosition)

  1. Load Project aggregate
  2. Pipeline.reorderStage(stageId, newPosition) — shifts positions
  3. Persist via ProjectRepository
  4. Raise StageReorderedEvent
  5. Return updated Pipeline
```

## Use Case: Create Task

```
CreateTaskUseCase.execute(projectId, input)

  1. Validate Project exists (cross-aggregate reference)
  2. Validate Stage exists (if stageId provided)
  3. Create Task aggregate root
  4. If assigneeIds provided: create TaskAssignment entities
  5. Persist via TaskRepository
  6. If assigned: raise TaskAssignedEvent
  7. Return Task aggregate
```

**Boundary**: Task Board Context (references Project/Stage by ID only)

## Use Case: Move Task Between Stages (Drag & Drop)

```
MoveTaskUseCase.execute(input: { taskId, targetStageId, targetPosition })

  1. Load Task aggregate
  2. Validate target Stage belongs to same Pipeline (cross-aggregate check)
  3. Task.moveTo(targetStageId, targetPosition) — returns TaskMovedEvent
  4. Persist via TaskRepository (atomic position shift)
  5. Publish TaskMovedEvent via RabbitMQ
  6. Return updated Task
```

**Domain Logic** (in Task entity):
```typescript
moveTo(targetStageId: string, targetPosition: number): TaskMovedEvent {
  const fromStageId = this.stageId;
  const fromPosition = this.position;

  this.stageId = targetStageId;
  this.position = targetPosition;

  return new TaskMovedEvent({
    taskId: this.id,
    fromStageId,
    fromPosition,
    toStageId: targetStageId,
    toPosition: targetPosition,
  });
}
```

**Infrastructure** (in TaskRepository):
```typescript
// Atomic position shift within a stage
async shiftPositions(stageId: string, fromPosition: number, toPosition: number) {
  // Decrement positions after old position in source stage
  // Increment positions at/beyond target position in target stage
}
```

## Use Case: Reorder Task Within Stage

```
ReorderTaskUseCase.execute(taskId, newPosition)

  1. Load Task aggregate
  2. Validate task is in same stage
  3. Task.reorder(newPosition) — shifts positions within stage
  4. Persist via TaskRepository
  5. Return updated Task
```

## Use Case: Assign Task

```
AssignTaskUseCase.execute(taskId, userIds[])

  1. Load Task aggregate
  2. Validate Users exist (cross-aggregate)
  3. Create TaskAssignment entities (within Task aggregate)
  4. Persist via TaskRepository
  5. Raise TaskAssignedEvent for each new assignment
  6. Return updated Task with assignments
```

## Use Case: Add Comment

```
AddCommentUseCase.execute(taskId, authorId, content)

  1. Load Task aggregate
  2. Create TaskComment entity
  3. Persist via TaskRepository
  4. Return updated Task with comments
```

## Task Filtering

Tasks support priority levels (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) and can be filtered:
- By stage
- By priority
- By assignee
- By due date range
- By search term (title/description)

## Reports & Analytics Use Cases (Read-Only)

> The Reports context is a **query/read side**. It has NO aggregates and issues NO write commands. It builds projections by reading the `Task`, `TaskAssignment`, and `Stage` tables (optionally cached in Redis or a materialized snapshot).

### Use Case: Get Project Dashboard Summary

```
GetProjectSummaryUseCase.execute(projectId, range)

  1. Load project (verify ownership)
  2. Aggregate tasks:
       total          = COUNT(tasks)
       done           = COUNT(tasks where stage is terminal / completedAt set)
       inProgress     = COUNT(tasks where stage is not terminal/backlog)
       backlog        = COUNT(tasks in first stage)
       completionRate = done / total * 100
  3. Optionally fetch from Redis cache (key: report:project:{id}:summary:{range})
  4. Return DashboardSummary read model
```

### Use Case: Get Tasks By Stage (Board Distribution)

```
GetProjectTasksByStageUseCase.execute(projectId)

  SELECT stage.name, stage.position, COUNT(task.id) as count
  FROM stage
  LEFT JOIN task ON task.stage_id = stage.id
  WHERE stage.pipeline.project_id = :projectId
  GROUP BY stage.id, stage.name, stage.position
  ORDER BY stage.position
```

### Use Case: Get Velocity / Throughput

```
GetProjectVelocityUseCase.execute(projectId, { range: 'week' })

  SELECT date_trunc(:bucket, task.completed_at) AS bucket,
         COUNT(task.id) AS completed
  FROM task
  WHERE task.project_id = :projectId
    AND task.completed_at IS NOT NULL
    AND task.completed_at BETWEEN :from AND :to
  GROUP BY bucket
  ORDER BY bucket

  Returns: [{ date, completed, runningTotal? }]
```

> Requires `task.completedAt` to be set when a task enters the terminal/"Done" stage via `MoveTaskUseCase` / `MoveTask` domain event.

### Use Case: Get Task Aging

```
GetProjectTaskAgingUseCase.execute(projectId)

  Buckets by age of OPEN (non-completed) tasks:
    0-1d    → COUNT(dueDate/createdAt within 1 day)
    1-3d    → COUNT(1-3 days old)
    3-7d    → COUNT(3-7 days old)
    7-14d   → COUNT(7-14 days old)
    14d+    → COUNT(older than 14 days)
```

### Use Case: Get Team Workload

```
GetProjectWorkloadUseCase.execute(projectId)

  SELECT u.id, u.name,
         COUNT(ta.task_id) AS openTasks
  FROM task_assignment ta
  JOIN task t ON t.id = ta.task_id
  JOIN "user" u ON u.id = ta.user_id
  WHERE t.project_id = :projectId
    AND t.completed_at IS NULL
  GROUP BY u.id, u.name
  ORDER BY openTasks DESC
```

### Use Case: Get Assignee Activity

```
GetProjectAssigneeActivityUseCase.execute(projectId, { range })

  Completed tasks per assignee within a time window:
    SELECT u.name, COUNT(t.id) AS completed
    FROM task_assignment ta
    JOIN task t ON t.id = ta.task_id
    JOIN "user" u ON u.id = ta.user_id
    WHERE t.project_id = :projectId
      AND t.completed_at BETWEEN :from AND :to
    GROUP BY u.name
```

### Use Case: Get User (Global) Dashboard

```
GetUserDashboardSummaryUseCase.execute(userId)

  Aggregates across ALL of the user's projects:
    projectCount   = COUNT(projects owned)
    totalTasks     = SUM over projects
    openTasks      = SUM tasks not completed
    overdueTasks   = COUNT(dueDate < now AND not completed)
    completionRate = completed / total * 100
    activityTrend  = last 7 days completions (for sparkline)
```

## Reports Caching Strategy

| Strategy | When | Mechanism |
|----------|------|-----------|
| **Direct SQL aggregation** | Default, small/medium data | Prisma `groupBy` / raw `pg` queries |
| **Redis cache** | Frequent dashboard loads | Cache JSON by `(userId, projectId, range, filters)`; TTL 5 min |
| **Materialized snapshot** | Large datasets / heavy velocity | Worker maintains `TaskSnapshot` from `TaskMoved`/`TaskCompleted` events |

**Cache-aside pattern**:
```
1. Check Redis key report:{scope}:{id}:{report}:{range}
2. Hit → return cached JSON
3. Miss → run aggregation, store, return
4. Invalidate on TaskMoved/TaskCompleted (or TTL)
```

## Security Considerations

- All endpoints require JWT authentication (`authenticate` middleware)
- Project access: only owner can modify (add `authorizeProject` middleware)
- Task move: validate stage belongs to same pipeline
- Stage delete: validate not the last stage (min 1 required)
- Rate limiting: reuse existing `rateLimiter` middleware
