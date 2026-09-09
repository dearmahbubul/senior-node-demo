# 05 - Implementation Phases & Open Questions

## Phase 1: Domain Layer Foundation
1. Create `src/contexts/project-management/domain/` — Project, Pipeline, Stage entities
2. Create `src/contexts/task-board/domain/` — Task, TaskAssignment, TaskComment entities
3. Define repository interfaces (no Prisma yet)
4. Define domain events (ProjectCreated, TaskMoved, TaskAssigned, TaskCompleted)
5. Update Prisma schema with new models (including `Task.completedAt` for velocity reports)

## Phase 2: Infrastructure Layer
1. Implement `PrismaProjectRepository` in `project-management/infrastructure/`
2. Implement `PrismaStageRepository` in `project-management/infrastructure/`
3. Implement `PrismaTaskRepository` in `task-board/infrastructure/`
4. Implement `PrismaTaskAssignmentRepository` in `task-board/infrastructure/`
5. Implement `PrismaTaskCommentRepository` in `task-board/infrastructure/`
6. Wire up RabbitMQ event publisher

## Phase 3: Application Layer (Use Cases)
1. `CreateProjectUseCase` — with auto pipeline + default stages
2. `AddStageUseCase`, `ReorderStageUseCase`, `DeleteStageUseCase`
3. `CreateTaskUseCase`, `MoveTaskUseCase`, `ReorderTaskUseCase`
4. `AssignTaskUseCase`, `UnassignTaskUseCase`
5. `AddCommentUseCase`, `DeleteCommentUseCase`

## Phase 4: Interfaces Layer (HTTP)
1. Project controller, validator, resource, routes
2. Stage routes (nested under projects)
3. Task controller, validator, resource, routes (nested under projects)
4. Task assignment routes (nested under tasks)
5. Task comment routes (nested under tasks)
6. Register all routes in `src/routes/index.ts`

## Phase 5: Reports & Analytics Context
1. Create `src/contexts/reports/domain/` — read models (`DashboardSummary`, `TasksByStage`, `Velocity`, `TaskAging`, `Workload`)
2. Implement `report.repository.ts` — SQL aggregations over Task/TaskAssignment/Stage tables
3. Implement `GetUserSummaryUseCase`, `GetUserTasksByStageUseCase`, `GetUserVelocityUseCase`
4. Implement project report use cases (`GetProjectSummaryUseCase`, `GetProjectTasksByStageUseCase`, `GetProjectVelocityUseCase`, `GetProjectTaskAgingUseCase`, `GetProjectWorkloadUseCase`, `GetProjectAssigneeActivityUseCase`)
5. Create report controller, validator, resource, routes
6. Add Redis cache layer (`report-cache.service.ts`) — cache-aside pattern
7. (Optional) Materialized `TaskSnapshot` table + event-consumer worker for heavy velocity queries

## Phase 6: Polish & Events
1. Wire up `TaskMovedEvent` → notification worker + reports projection
2. Wire up `TaskAssignedEvent` → email notification
3. Add filtering/search to task listing
4. Add activity log / audit trail
5. Add bulk operations (bulk move, bulk assign)
6. Add WebSocket support for real-time updates (future)

## Testing Strategy

- **Unit Tests**: Domain entities (business rules), Use Cases (mock repositories)
- **Integration Tests**: Full request → response cycle per endpoint
- **E2E Tests**: Multi-step flows (create project → add stage → create task → move task)
- **Report Tests**: Verify aggregation SQL returns correct counts after seed data

```bash
npm run typecheck   # Type safety
npm run format      # Code style
```

## Migration Path (From Current Codebase)

1. Create `src/contexts/` directory structure
2. Move existing `src/modules/projects/` → `src/contexts/project-management/`
3. Move existing `src/modules/tasks/` → `src/contexts/task-board/`
4. Extract domain entities from service/repository files
5. Create Use Case files from service methods
6. Implement repository interfaces in infrastructure/
7. Update controllers to call Use Cases instead of services
8. Update route registration

## Open Questions for Team Review

1. **Multi-assignee**: Should tasks support multiple assignees or single? (Plan assumes multi)
2. **Stage limits**: Max stages per pipeline? (Suggest: 20)
3. **Task limits**: Max tasks per stage? (Suggest: 500, use cursor pagination)
4. **Soft delete**: Should tasks/projects be soft-deleted or hard-deleted?
5. **Templates**: Should we support project templates with pre-defined pipelines?
6. **Permissions**: Should we add role-based access (admin, member, viewer)?
7. **Context boundaries**: Should TaskBoard be its own context, or should tasks live inside ProjectManagement?
8. **Reports scale**: Start with direct SQL aggregation, or invest in materialized snapshot from the beginning?
9. **Which stage is "Done"?**: Reports need a canonical terminal stage. Hardcode the last stage as Done, allow per-project config, or use a stage flag `isDone: Boolean`?
10. **Dashboard scope**: Should the user dashboard include report filters by project, or is it always global? (API supports both — clarify UI needs)
