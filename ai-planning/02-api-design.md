# 02 - API Endpoints

All endpoints are prefixed with `/api` and require JWT authentication.

> **Model**: ClickUp-style. An **Organization** (ClickUp Workspace) is the **tenant**. It owns **Projects** (ClickUp Lists), each owning **Stages** (ClickUp Statuses) directly — no separate Pipeline entity. All tenant-scoped routes are nested under `/organizations/:orgId`; the `:orgId` always comes from the URL, never from the request body.

## Organization Management Context (Tenancy)

### Organizations

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/organizations` | Create an organization (first user becomes OWNER) | `CreateOrganizationUseCase` |
| GET | `/api/organizations` | List the caller's organizations | `ListOrganizationsUseCase` |
| GET | `/api/organizations/:orgId` | Get organization detail + membership | `GetOrganizationUseCase` |
| PATCH | `/api/organizations/:orgId` | Update name/slug (OWNER/ADMIN) | `UpdateOrganizationUseCase` |
| DELETE | `/api/organizations/:orgId` | Delete organization (cascades projects/stages/tasks) | `DeleteOrganizationUseCase` |

### Membership & Roles

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/organizations/:orgId/members` | Add member (OWNER/ADMIN) | `AddMemberUseCase` |
| GET | `/api/organizations/:orgId/members` | List members + roles | `ListMembersUseCase` |
| PATCH | `/api/organizations/:orgId/members/:userId` | Change member role | `UpdateMemberRoleUseCase` |
| DELETE | `/api/organizations/:orgId/members/:userId` | Remove member | `RemoveMemberUseCase` |

### Tenant Domains (Host-Based Routing)

Every **Organization gets a default subdomain when created**; an OWNER/ADMIN can later add (and verify) an optional **custom domain**.

| What | Example |
|------|---------|
| Default tenant URL (auto-provisioned from slug) | `https://acme.taskflow.app/...` — base host from `APP_BASE_HOST` |
| Custom domain (after DNS verification) | `https://app.acme.com/...` — overrides the subdomain |

**Mechanics**: the `resolveTenant` middleware (mounted before all API routes) reads the `Host` header, resolves it via `organizationQueries.findByHost(host)` (exact custom-domain match first, then `*.APP_BASE_HOST` subdomain match — both reads go to the **primary** DB, see `07`), and stashes the org id on `res.locals.organizationId`. All `:orgId`-scoped routes trust this value; a request that matches no tenant is rejected.

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| PATCH | `/api/organizations/:orgId/domain` | Change the organization subdomain (`{ subdomain }`) — OWNER/ADMIN | `UpdateSubdomainUseCase` |
| POST | `/api/organizations/:orgId/custom-domain` | Request a custom domain — returns a **DNS TXT token** (`_taskflow-verification.<domain>`); nothing changes until verified | `RequestCustomDomainUseCase` |
| POST | `/api/organizations/:orgId/custom-domain/verify` | Verify the TXT record and **activate** the custom domain; `409` if the record is missing/incorrect | `VerifyCustomDomainUseCase` |
| DELETE | `/api/organizations/:orgId/custom-domain` | Remove the custom domain — tenant reverts to the subdomain | `RemoveCustomDomainUseCase` |

> **Note**: On signup the Auth module auto-creates a parent **personal Organization** (`OrganizationCreatedEvent`) so every existing flow (projects/tasks) immediately has a tenant — and a working subdomain — to belong to.

## Project Management Context

### Projects (tenant-scoped)

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/organizations/:orgId/projects/blueprint` | Generate a project blueprint (name, description, stages) from a prompt — **AI, no writes** | `GenerateProjectBlueprintUseCase` |
| POST | `/api/organizations/:orgId/projects` | Create project — optional `stages[]`, else default stages | `CreateProjectUseCase` |
| GET | `/api/organizations/:orgId/projects` | List projects in the organization | `ListProjectsUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId` | Get project detail with stages | `GetProjectUseCase` |
| PATCH | `/api/organizations/:orgId/projects/:projectId` | Update name/description | `UpdateProjectUseCase` |
| DELETE | `/api/organizations/:orgId/projects/:projectId` | Delete project (cascades stages, tasks) | `DeleteProjectUseCase` |

### Stages (owned directly by a Project — no pipeline)

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/organizations/:orgId/projects/:projectId/stages` | Add a new stage to project | `AddStageUseCase` |
| PATCH | `/api/organizations/:orgId/projects/:projectId/stages/:stageId` | Update stage name/color | `UpdateStageUseCase` |
| PATCH | `/api/organizations/:orgId/projects/:projectId/stages/:stageId/reorder` | Reorder stage position | `ReorderStageUseCase` |
| DELETE | `/api/organizations/:orgId/projects/:projectId/stages/:stageId` | Delete stage (tasks become unstage) | `DeleteStageUseCase` |

## Task Board Context

### Tasks

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/organizations/:orgId/projects/:projectId/tasks` | Create task in a stage | `CreateTaskUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId/tasks` | List tasks (filter by stage, priority, assignee) | `ListTasksUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId` | Get task detail | `GetTaskUseCase` |
| PATCH | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId` | Update task (title, description, priority, dueDate) | `UpdateTaskUseCase` |
| PATCH | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId/move` | **Move task** to another stage + position | `MoveTaskUseCase` |
| PATCH | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId/reorder` | Reorder task within same stage | `ReorderTaskUseCase` |
| DELETE | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId` | Delete task | `DeleteTaskUseCase` |

### Task Assignments

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId/assign` | Assign user(s) to task | `AssignTaskUseCase` |
| DELETE | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId/assign/:userId` | Unassign user | `UnassignTaskUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId/assignments` | List assignees | `GetTaskUseCase` (includes assignments) |

### Task Comments

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId/comments` | Add comment | `AddCommentUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId/comments` | List comments | `GetTaskUseCase` (includes comments) |
| DELETE | `/api/organizations/:orgId/projects/:projectId/tasks/:taskId/comments/:commentId` | Delete comment | `DeleteCommentUseCase` |

## Reports & Analytics Context

### Organization Dashboard (per tenant)

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| GET | `/api/organizations/:orgId/reports/summary` | Org metrics (projects, tasks, completion rate) | `GetOrganizationSummaryUseCase` |
| GET | `/api/organizations/:orgId/reports/tasks-by-stage` | Tasks grouped by stage across org projects | `GetOrganizationTasksByStageUseCase` |
| GET | `/api/organizations/:orgId/reports/tasks-by-priority` | Tasks grouped by priority | `GetOrganizationTasksByPriorityUseCase` |
| GET | `/api/organizations/:orgId/reports/velocity?range=week` | Throughput over time | `GetOrganizationVelocityUseCase` |
| GET | `/api/organizations/:orgId/reports/overdue` | Overdue tasks | `GetOrganizationOverdueTasksUseCase` |
| GET | `/api/organizations/:orgId/reports/upcoming?days=7` | Tasks due within a window | `GetOrganizationUpcomingTasksUseCase` |
| GET | `/api/organizations/:orgId/reports/workload` | Per-assignee open task counts | `GetOrganizationWorkloadUseCase` |
| GET | `/api/organizations/:orgId/reports/assignee-activity` | Completed tasks per assignee over range | `GetOrganizationAssigneeActivityUseCase` |

### Project Dashboard (within an org)

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| GET | `/api/organizations/:orgId/projects/:projectId/reports/summary` | Project metrics (total, done, active, completion rate) | `GetProjectSummaryUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId/reports/tasks-by-stage` | Task distribution by stage (board counts) | `GetProjectTasksByStageUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId/reports/tasks-by-priority` | Task distribution by priority | `GetProjectTasksByPriorityUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId/reports/velocity?range=week` | Project throughput over time | `GetProjectVelocityUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId/reports/aging` | Task age distribution (0-1d, 1-3d, 3-7d, 7-14d, 14d+) | `GetProjectTaskAgingUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId/reports/workload` | Per-assignee open task counts | `GetProjectWorkloadUseCase` |
| GET | `/api/organizations/:orgId/projects/:projectId/reports/assignee-activity` | Completed tasks per assignee over range | `GetProjectAssigneeActivityUseCase` |

### Reusable Query Parameters

| Param | Type | Applies To | Description |
|-------|------|-----------|-------------|
| `range` | `day \| week \| month \| quarter \| year` | velocity, activity | Time bucket granularity |
| `from` / `to` | ISO date | all reports | Custom date window |
| `stageId` | UUID | project reports | Filter to a single stage |
| `priority` | `LOW \| MEDIUM \| HIGH \| URGENT` | project reports | Filter by priority |
| `assigneeId` | UUID | project reports | Filter by assignee |

> **Note**: All report endpoints are **read-only** and lag-tolerant — they are the primary candidates to run against DB **read replicas** (see [07-infrastructure-scaling.md](07-infrastructure-scaling.md)).

## Route Registration

```typescript
// src/routes/index.ts
import { resolveTenant } from '@common/middleware/resolve-tenant';
import organizationRoutes from '@modules/organization-management/interfaces/http/organization.routes';
import projectRoutes from '@modules/project-management/interfaces/http/project.routes';
import taskRoutes from '@modules/task-board/interfaces/http/task.routes';
import reportRoutes from '@modules/reports/interfaces/http/report.routes';

const router = Router();
router.use(authenticate);
router.use(resolveTenant);                            // Host → organization (subdomain/custom domain)
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);     // + /:orgId/domain, custom-domain sub-routes
router.use('/organizations/:orgId', projectRoutes);   // projects + stages nested
router.use('/organizations/:orgId', taskRoutes);       // tasks, assignments, comments
router.use('/organizations/:orgId', reportRoutes);     // org + project reports
// Every nested router reads :orgId from the URL; `authorizeMembership` runs first.
```