# 02 - API Endpoints

All endpoints are prefixed with `/api` and require JWT authentication.

## Project Management Context

### Projects

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/projects` | Create project (auto-creates pipeline with default stages) | `CreateProjectUseCase` |
| GET | `/api/projects` | List user's projects | `ListProjectsUseCase` |
| GET | `/api/projects/:id` | Get project detail with pipeline | `GetProjectUseCase` |
| PATCH | `/api/projects/:id` | Update project name/description | `UpdateProjectUseCase` |
| DELETE | `/api/projects/:id` | Delete project (cascades pipeline, stages, tasks) | `DeleteProjectUseCase` |

### Pipelines

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| GET | `/api/projects/:projectId/pipeline` | Get pipeline with all stages | `GetProjectUseCase` (includes pipeline) |
| PATCH | `/api/projects/:projectId/pipeline` | Update pipeline settings | `UpdatePipelineUseCase` |

### Stages

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/projects/:projectId/stages` | Add a new stage to pipeline | `AddStageUseCase` |
| PATCH | `/api/projects/:projectId/stages/:id` | Update stage name/color | `UpdateStageUseCase` |
| PATCH | `/api/projects/:projectId/stages/:id/reorder` | Reorder stage position | `ReorderStageUseCase` |
| DELETE | `/api/projects/:projectId/stages/:id` | Delete stage (tasks become unstage) | `DeleteStageUseCase` |

## Task Board Context

### Tasks

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/projects/:projectId/tasks` | Create task in a stage | `CreateTaskUseCase` |
| GET | `/api/projects/:projectId/tasks` | List tasks (filterable by stage, priority, assignee) | `ListTasksUseCase` |
| GET | `/api/projects/:projectId/tasks/:id` | Get task detail | `GetTaskUseCase` |
| PATCH | `/api/projects/:projectId/tasks/:id` | Update task (title, description, priority, dueDate) | `UpdateTaskUseCase` |
| PATCH | `/api/projects/:projectId/tasks/:id/move` | **Move task** to another stage + position | `MoveTaskUseCase` |
| PATCH | `/api/projects/:projectId/tasks/:id/reorder` | Reorder task within same stage | `ReorderTaskUseCase` |
| DELETE | `/api/projects/:projectId/tasks/:id` | Delete task | `DeleteTaskUseCase` |

### Task Assignments

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/projects/:projectId/tasks/:taskId/assign` | Assign user(s) to task | `AssignTaskUseCase` |
| DELETE | `/api/projects/:projectId/tasks/:taskId/assign/:userId` | Unassign user | `UnassignTaskUseCase` |
| GET | `/api/projects/:projectId/tasks/:taskId/assignments` | List assignees | `GetTaskUseCase` (includes assignments) |

### Task Comments

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| POST | `/api/projects/:projectId/tasks/:taskId/comments` | Add comment | `AddCommentUseCase` |
| GET | `/api/projects/:projectId/tasks/:taskId/comments` | List comments | `GetTaskUseCase` (includes comments) |
| DELETE | `/api/projects/:projectId/tasks/:taskId/comments/:commentId` | Delete comment | `DeleteCommentUseCase` |

## Reports & Analytics Context

### User Dashboard (Global — across all user's projects)

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| GET | `/api/reports/user/summary` | Overall user metrics (projects, tasks, completion rate) | `GetUserDashboardSummaryUseCase` |
| GET | `/api/reports/user/tasks-by-stage` | Tasks grouped by stage across all projects | `GetUserTasksByStageUseCase` |
| GET | `/api/reports/user/tasks-by-priority` | Tasks grouped by priority | `GetUserTasksByPriorityUseCase` |
| GET | `/api/reports/user/velocity?range=week` | Completed tasks per day/week (throughput trend) | `GetUserVelocityUseCase` |
| GET | `/api/reports/user/overdue` | List of overdue tasks (all projects) | `GetUserOverdueTasksUseCase` |
| GET | `/api/reports/user/upcoming?days=7` | Tasks due within a window | `GetUserUpcomingTasksUseCase` |
| GET | `/api/reports/user/workload` | Tasks per assignee (via assignments) | `GetUserWorkloadUseCase` |

### Project Dashboard (Per Project)

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| GET | `/api/projects/:projectId/reports/summary` | Project metrics (total, done, active, completion rate) | `GetProjectDashboardSummaryUseCase` |
| GET | `/api/projects/:projectId/reports/tasks-by-stage` | Task distribution by stage (board counts) | `GetProjectTasksByStageUseCase` |
| GET | `/api/projects/:projectId/reports/tasks-by-priority` | Task distribution by priority | `GetProjectTasksByPriorityUseCase` |
| GET | `/api/projects/:projectId/reports/velocity?range=week` | Project throughput over time | `GetProjectVelocityUseCase` |
| GET | `/api/projects/:projectId/reports/aging` | Task age distribution (0-1d, 1-3d, 3-7d, 7-14d, 14d+) | `GetProjectTaskAgingUseCase` |
| GET | `/api/projects/:projectId/reports/workload` | Per-assignee open task counts | `GetProjectWorkloadUseCase` |
| GET | `/api/projects/:projectId/reports/assignee-activity` | Completed tasks per assignee over range | `GetProjectAssigneeActivityUseCase` |

### Reusable Query Parameters

| Param | Type | Applies To | Description |
|-------|------|-----------|-------------|
| `range` | `day \| week \| month \| quarter \| year` | velocity, activity | Time bucket granularity |
| `from` / `to` | ISO date | all reports | Custom date window |
| `stageId` | UUID | project reports | Filter to a single stage |
| `priority` | `LOW \| MEDIUM \| HIGH \| URGENT` | project reports | Filter by priority |
| `assigneeId` | UUID | project reports | Filter by assignee |

> **Note**: All report endpoints are **read-only**. They never mutate domain state — they only query/aggregate task data or consume event-driven projections.

## Route Registration

```typescript
// src/routes/index.ts
import projectRoutes from '@contexts/project-management/interfaces/project.routes';
import taskRoutes from '@contexts/task-board/interfaces/task.routes';
import reportRoutes from '@contexts/reports/interfaces/report.routes';

const router = Router();
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/reports', reportRoutes);
// Tasks are nested under projects: /api/projects/:projectId/tasks
// Project reports: /api/projects/:projectId/reports/...
```
