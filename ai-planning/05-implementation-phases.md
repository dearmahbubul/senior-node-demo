# 05 - Implementation Phases & Open Questions

## Phase 1: Domain Layer Foundation
1. Create `src/modules/organization-management/domain/` — `Organization`, `OrganizationMembership` entities, `OrgRole`/`Slug`/`Subdomain`/`CustomDomain`/`DomainVerificationToken` VOs, `OrganizationRepositoryPort`, `OrganizationMembershipRepositoryPort`, `DomainVerificationPort`, events (`OrganizationCreated`, `SubdomainChanged`, `CustomDomainVerified`, `CustomDomainRemoved`, `MemberAdded`)
2. Create `src/modules/project-management/domain/` — Project, Stage entities
3. Create `src/modules/task-board/domain/` — Task, TaskAssignment, TaskComment entities
4. Define repository ports (interfaces in `domain/ports/`) — no Prisma yet
5. Define domain events (ProjectCreated, TaskMoved, TaskAssigned, TaskCompleted) + each module's own `*-event-publisher.port.ts`
6. Define consumer-owned cross-module query ports: `MembershipQueryPort` (project-management, reports), `OrganizationQueryPort` (reports), `ProjectQueryPort`, `StageQueryPort`, `UserQueryPort` (task-board), `ProjectQueryPort` (reports) — all return `organizationId` where relevant
7. Define domain-owned value types for enums (`TaskPriority` union) so domain never imports Prisma
8. Update Prisma schema with new models (Organization + tenant domain columns `subdomain`/`customDomain`/`customDomainVerificationToken`/`customDomainVerifiedAt`, OrganizationMembership, `enum OrgRole`, `organizationId` on Project/Stage/Task, `Task.completedAt`, `Stage.isDone`)

> **Tenant migration**: after models exist, run the backfill (personal Organization per existing User, assign existing Project/Stage/Task rows to their owner's org) **before** enforcing `organizationId NOT NULL` — see [01-domain-model.md](01-domain-model.md#migration-strategy-incl-tenancy).

## Phase 2: Infrastructure Layer (Adapters)
1. Implement `PrismaOrganizationRepository` + `PrismaOrganizationMembershipRepository` in `organization-management/infrastructure/persistence/`
2. Implement `DnsVerificationAdapter` in `organization-management/infrastructure/verification/` (implements `DomainVerificationPort` via Node `dns/promises` TXT lookup)
2. Implement `PrismaProjectRepository` in `project-management/infrastructure/persistence/`
3. Implement `PrismaStageRepository` in `project-management/infrastructure/persistence/`
4. Implement `PrismaTaskRepository` in `task-board/infrastructure/persistence/` (with Prisma enum → domain-union mappers: `toDomain` / `toPersistence`)
5. Implement `PrismaTaskAssignmentRepository` in `task-board/infrastructure/persistence/`
6. Implement `PrismaTaskCommentRepository` in `task-board/infrastructure/persistence/`
7. Implement `RabbitMQTaskEventPublisher` in `task-board/infrastructure/events/` (implements `TaskEventPublisherPort`)
8. Implement cross-module gateways in `task-board/infrastructure/gateways/`: `project-query.gateway.ts`, `stage-query.gateway.ts`, `user-query.gateway.ts`
9. Implement `membership-query.gateway.ts` in `project-management/infrastructure/gateways/` (`authorizeMembership` + use-case validation)
10. Implement `project-query.gateway.ts`, `organization-query.gateway.ts`, `membership-query.gateway.ts` in `reports/infrastructure/gateways/`
11. Add `common/middleware/authorizeMembership.ts` (wired to `organizationQueries` facade in the composition root)
12. Add `common/middleware/resolve-tenant.ts` — resolves `Host` → organization via `organizationQueries.findByHost` (custom domain first, then `*.APP_BASE_HOST`); stashes `res.locals.organizationId`

## Phase 3: Application Layer (Use Cases)
1. `CreateOrganizationUseCase`, `GetOrganizationUseCase`, `ListOrganizationsUseCase`, `UpdateOrganizationUseCase`, `DeleteOrganizationUseCase`
2. `UpdateSubdomainUseCase`, `RequestCustomDomainUseCase`, `VerifyCustomDomainUseCase`, `RemoveCustomDomainUseCase`
3. `AddMemberUseCase`, `ListMembersUseCase`, `UpdateMemberRoleUseCase`, `RemoveMemberUseCase`
4. `CreateProjectUseCase` — with auto default stages, tenant-scoped (`orgId` + membership)
5. `AddStageUseCase`, `ReorderStageUseCase`, `DeleteStageUseCase`
6. `CreateTaskUseCase`, `MoveTaskUseCase`, `ReorderTaskUseCase`
7. `AssignTaskUseCase`, `UnassignTaskUseCase`
8. `AddCommentUseCase`, `DeleteCommentUseCase`

## Phase 4: Composition Root & Interfaces (HTTP)
1. Create `src/common/di/container.ts` — wire adapters → use cases (+ `authorizeMembership`/`resolveTenant` → `organizationQueries`)
2. Create module barrel files (`organization-management/index.ts`, `project-management/index.ts`, `task-board/index.ts`)
3. Organization controller, validator, resource, routes (+ membership routes nested)
4. Tenant domain controller, validator, resource, routes (`/:orgId/domain`, `/:orgId/custom-domain`)
5. Mount `resolveTenant` before all API routes; keep `:orgId`-scoped routers nested under `/organizations/:orgId`
6. Project controller, validator, resource, routes (nested under `/organizations/:orgId`)
7. Stage routes (nested under projects)
8. Task controller, validator, resource, routes (nested under projects)
9. Task assignment routes (nested under tasks)
10. Task comment routes (nested under tasks)
11. Register all routes in `src/routes/index.ts`

## Phase 5: Reports Module
1. Create `src/modules/reports/domain/` — read models (`DashboardSummary`, `TasksByStage`, `Velocity`, `TaskAging`, `Workload`)
2. Implement `PrismaReportQueryAdapter` in `reports/infrastructure/persistence/` (served from **read replica** — see `07-infrastructure-scaling.md`)
3. Implement organization report use cases (`GetOrganizationSummaryUseCase`, `GetOrganizationTasksByStageUseCase`, `GetOrganizationVelocityUseCase`, `GetOrganizationOverdueTasksUseCase`, `GetOrganizationUpcomingTasksUseCase`, `GetOrganizationWorkloadUseCase`, `GetOrganizationAssigneeActivityUseCase`)
4. Implement project report use cases (`GetProjectSummaryUseCase`, `GetProjectTasksByStageUseCase`, `GetProjectVelocityUseCase`, `GetProjectTaskAgingUseCase`, `GetProjectWorkloadUseCase`, `GetProjectAssigneeActivityUseCase`)
5. Create report controller, validator, resource, routes (nested under `/organizations/:orgId[/projects/:projectId]`)
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
4. Implement `GenerateProjectBlueprintUseCase` (+ fallback to default stages, tenant-scoped via `orgId` + membership)
5. Extend `CreateProjectUseCase` to accept optional `stages[]`
6. Add `POST /api/organizations/:orgId/projects/blueprint` route + validator (prompt required, ≤ 2000 chars) + rate limiting

## Testing Strategy

- **Unit Tests**: Domain entities (business rules), Use Cases (mock repository ports) — colocated in each module's `__tests__/`
- **Integration Tests**: Full request → response cycle per endpoint
- **E2E Tests**: Multi-step flows (create project → add stage → create task → move task)
- **Report Tests**: Verify aggregation SQL returns correct counts after seed data
- **Tenancy Tests**: cross-tenant isolation (user A cannot read/act in org B even with a valid JWT), role gating (VIEWER blocked from writes), `authorizeMembership` rejects non-members, org backfill migration correctness, `resolveTenant` host matching (subdomain + verified custom domain, unmatched host rejected), custom domain must be DNS-verified before it activates, subdomain uniqueness
- **AI Blueprint Tests**: `GenerateProjectBlueprintUseCase` with a fake `ProjectBlueprintGeneratorPort`; `Project.create()` invariants with AI-generated stages (count/uniqueness/`isDone`); adapter tested against a recorded fixture (no live API in CI); fallback to default blueprint when the port returns `null`

```bash
npm run typecheck   # Type safety
npm run format      # Code style
```

## Migration Path (From Current Codebase)

1. Create `src/modules/` directory structure with module sub-directories
2. Create `src/modules/organization-management/` (new tenant module) + add `organizationId` columns to `Project`/`Stage`/`Task`
3. Run tenant backfill migration: personal Organization per User (**subdomain = slug**, collision suffix), assign existing rows to owner's org, then enforce `organizationId NOT NULL` + `subdomain` uniqueness
4. Move existing `src/modules/projects/` → `src/modules/project-management/` with new internal layers
5. Move existing `src/modules/tasks/` → `src/modules/task-board/` with new internal layers
6. Extract domain entities from service/repository files into `domain/entities/`
7. Extract repository interfaces as ports in `domain/ports/`
8. Move existing Prisma repositories to `infrastructure/persistence/` (adapters)
9. Create use case files from service methods in `application/`
10. Create `src/common/di/container.ts` — composition root wiring adapters to use cases
11. Refactor controllers to call use cases from the composition root, adding `authorizeMembership` to all `/:orgId` routes
12. Create module barrel files and update `src/routes/index.ts`

## Open Questions for Team Review

1. **Multi-assignee**: Should tasks support multiple assignees or single? (Plan assumes multi)
2. **Stage limits**: Max stages per project? (Suggest: 20)
3. **Task limits**: Max tasks per stage? (Suggest: 500, use cursor pagination)
4. **Soft delete**: Should tasks/projects be soft-deleted or hard-deleted?
5. **Templates**: Should we support project templates with pre-defined stages?
6. **Tenant roles**: Are OWNER/ADMIN/MEMBER/VIEWER sufficient, or do we need per-project roles (e.g., project-level VIEWER/EDITOR)?
7. **Domain verification**: manual TXT publish + server-side readback (current plan) vs. auto-creating records via a DNS provider (Route53/Cloudflare) — do we plan self-serve onboarding at scale?
8. **Reserved subdomains**: maintain a blocklist (www, api, admin, app, mail, static, auth) — and can users re-use one if a tenant is archived?
9. **Personal organization**: On signup, should the personal org be created with a default name/slug (e.g., `{user} workspace`) or created lazily on first project?
10. **Invitations**: Should membership use email invites (pending state) or only direct adds by OWNER/ADMIN?
11. **Module boundaries**: Should TaskBoard be its own module, or should tasks live inside ProjectManagement?
12. **Reports scale**: Start with direct SQL aggregation, or invest in materialized snapshot from the beginning?
13. **Which stage is "Done"?**: Reports need a canonical terminal stage. Hardcode the last stage as Done, allow per-project config, or use a stage flag `isDone: Boolean`?
14. **AI blueprint — starter tasks**: should the AI also propose a few starter tasks per stage? (Stretch: `TaskSuggestionPort` in `task-board`)
15. **AI blueprint — provider & cost caps**: default model (`LLM_MODEL`), max generated stages (`LLM_MAX_STAGES`), and per-user/global rate limits to cap spend?
16. **Read replicas**: which additional read paths should move off the primary once replicas exist (audit trails, dropdown lookups, export jobs)?
