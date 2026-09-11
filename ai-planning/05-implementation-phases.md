# 05 - Implementation Phases & Open Questions

## Phase 1: Domain Layer Foundation
1. Create `src/modules/project-management/domain/` — Project, Stage entities
2. Create `src/modules/task-board/domain/` — Task, TaskAssignment, TaskComment entities
3. Define repository ports (interfaces in `domain/ports/`) — no Prisma yet
4. Define domain events (ProjectCreated, TaskMoved, TaskAssigned, TaskCompleted) + each module's own `*-event-publisher.port.ts`
5. Define consumer-owned cross-module query ports: `ProjectQueryPort`, `StageQueryPort`, `UserQueryPort` (task-board), `ProjectQueryPort` (reports)
6. Define domain-owned value types for enums (`TaskPriority` union) so domain never imports Prisma
7. Update Prisma schema with new models (including `Task.completedAt`, `Stage.isDone`)

## Phase 2: Infrastructure Layer (Adapters)
1. Implement `PrismaProjectRepository` in `project-management/infrastructure/persistence/`
2. Implement `PrismaStageRepository` in `project-management/infrastructure/persistence/`
3. Implement `PrismaTaskRepository` in `task-board/infrastructure/persistence/` (with Prisma enum → domain-union mappers: `toDomain` / `toPersistence`)
4. Implement `PrismaTaskAssignmentRepository` in `task-board/infrastructure/persistence/`
5. Implement `PrismaTaskCommentRepository` in `task-board/infrastructure/persistence/`
6. Implement `RabbitMQTaskEventPublisher` in `task-board/infrastructure/events/` (implements `TaskEventPublisherPort`)
7. Implement cross-module gateways in `task-board/infrastructure/gateways/`: `project-query.gateway.ts`, `stage-query.gateway.ts`, `user-query.gateway.ts`
8. Implement `project-query.gateway.ts` in `reports/infrastructure/gateways/` (project ownership checks)

## Phase 3: Application Layer (Use Cases)
1. `CreateProjectUseCase` — with auto default stages
2. `AddStageUseCase`, `ReorderStageUseCase`, `DeleteStageUseCase`
3. `CreateTaskUseCase`, `MoveTaskUseCase`, `ReorderTaskUseCase`
4. `AssignTaskUseCase`, `UnassignTaskUseCase`
5. `AddCommentUseCase`, `DeleteCommentUseCase`

## Phase 4: Composition Root & Interfaces (HTTP)
1. Create `src/common/di/container.ts` — wire adapters → use cases
2. Create module barrel files (`project-management/index.ts`, `task-board/index.ts`)
3. Project controller, validator, resource, routes
4. Stage routes (nested under projects)
5. Task controller, validator, resource, routes (nested under projects)
6. Task assignment routes (nested under tasks)
7. Task comment routes (nested under tasks)
8. Register all routes in `src/routes/index.ts`

## Phase 5: Reports Module
1. Create `src/modules/reports/domain/` — read models (`DashboardSummary`, `TasksByStage`, `Velocity`, `TaskAging`, `Workload`)
2. Implement `PrismaReportQueryAdapter` in `reports/infrastructure/persistence/`
3. Implement user report use cases (`GetUserSummaryUseCase`, `GetUserTasksByStageUseCase`, `GetUserVelocityUseCase`)
4. Implement project report use cases (`GetProjectSummaryUseCase`, `GetProjectTasksByStageUseCase`, `GetProjectVelocityUseCase`, `GetProjectTaskAgingUseCase`, `GetProjectWorkloadUseCase`, `GetProjectAssigneeActivityUseCase`)
5. Create report controller, validator, resource, routes
6. Add `ReportCacheAdapter` in `reports/infrastructure/cache/` — Redis cache-aside pattern
7. (Optional) Materialized `TaskSnapshot` table + event-consumer worker for heavy velocity queries

## Phase 6: Polish & Events
1. Wire up `TaskMovedEvent` → notification worker + reports projection
2. Wire up `TaskAssignedEvent` → email notification
3. Add filtering/search to task listing
4. Add activity log / audit trail
5. Add bulk operations (bulk move, bulk assign)
6. Add WebSocket support for real-time updates (future)

## Phase 7: AI-Assisted Project Setup (Blueprint) — see [06-ai-project-blueprint.md](06-ai-project-blueprint.md)
1. Add `ProjectBlueprint` / `StageDraft` VOs + `ProjectBlueprintGeneratorPort` to `project-management/domain/` (no SDK in domain)
2. Add `common/llm/` shared LLM client (provider via env)
3. Implement `OpenAIBlueprintGeneratorAdapter` in `project-management/infrastructure/ai/` (structured output, normalization, `null` on failure)
4. Implement `GenerateProjectBlueprintUseCase` (+ fallback to default stages)
5. Extend `CreateProjectUseCase` to accept optional `stages[]`
6. Add `POST /api/projects/blueprint` route + validator (prompt required, ≤ 2000 chars) + rate limiting

## Testing Strategy

- **Unit Tests**: Domain entities (business rules), Use Cases (mock repository ports) — colocated in each module's `__tests__/`
- **Integration Tests**: Full request → response cycle per endpoint
- **E2E Tests**: Multi-step flows (create project → add stage → create task → move task)
- **Report Tests**: Verify aggregation SQL returns correct counts after seed data
- **AI Blueprint Tests**: `GenerateProjectBlueprintUseCase` with a fake `ProjectBlueprintGeneratorPort`; `Project.create()` invariants with AI-generated stages (count/uniqueness/`isDone`); adapter tested against a recorded fixture (no live API in CI); fallback to default blueprint when the port returns `null`

```bash
npm run typecheck   # Type safety
npm run format      # Code style
```

## Migration Path (From Current Codebase)

1. Create `src/modules/` directory structure with module sub-directories
2. Move existing `src/modules/projects/` → `src/modules/project-management/` with new internal layers
3. Move existing `src/modules/tasks/` → `src/modules/task-board/` with new internal layers
4. Extract domain entities from service/repository files into `domain/entities/`
5. Extract repository interfaces as ports in `domain/ports/`
6. Move existing Prisma repositories to `infrastructure/persistence/` (adapters)
7. Create use case files from service methods in `application/`
8. Create `src/common/di/container.ts` — composition root wiring adapters to use cases
9. Refactor controllers to call use cases from the composition root
10. Create module barrel files and update `src/routes/index.ts`

## Open Questions for Team Review

1. **Multi-assignee**: Should tasks support multiple assignees or single? (Plan assumes multi)
2. **Stage limits**: Max stages per project? (Suggest: 20)
3. **Task limits**: Max tasks per stage? (Suggest: 500, use cursor pagination)
4. **Soft delete**: Should tasks/projects be soft-deleted or hard-deleted?
5. **Templates**: Should we support project templates with pre-defined stages?
6. **Permissions**: Should we add role-based access (admin, member, viewer)?
7. **Module boundaries**: Should TaskBoard be its own module, or should tasks live inside ProjectManagement?
8. **Reports scale**: Start with direct SQL aggregation, or invest in materialized snapshot from the beginning?
9. **Which stage is "Done"?**: Reports need a canonical terminal stage. Hardcode the last stage as Done, allow per-project config, or use a stage flag `isDone: Boolean`?
10. **Dashboard scope**: Should the user dashboard include report filters by project, or is it always global? (API supports both — clarify UI needs)
11. **AI blueprint — starter tasks**: should the AI also propose a few starter tasks per stage? (Stretch: `TaskSuggestionPort` in `task-board`)
12. **AI blueprint — provider & cost caps**: default model (`LLM_MODEL`), max generated stages (`LLM_MAX_STAGES`), and per-user/global rate limits to cap spend?
