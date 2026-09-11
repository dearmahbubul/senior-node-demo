# 04 - Core Business Logic (DDD Use Cases)

> **Cross-module reads** (organization exists, membership/role, project exists, stage belongs to project, users exist) are expressed as **query ports owned by the calling module** — `OrganizationQueryPort`, `MembershipQueryPort`, `ProjectQueryPort`, `StageQueryPort`, `UserQueryPort` — and implemented as gateways in `infrastructure/gateways/`. Use cases depend only on those ports, never on another module's internals. SQL/Prisma snippets below are **adapter implementations** of the relevant ports; the use case itself never sees the SQL.

> **Tenancy**: every write use case receives `{ orgId, actorId }`. `actorId` comes from the JWT; `orgId` comes **only from the URL**, never the body. The interface layer applies `authorizeMembership({ orgId, minRole })`; use cases additionally re-validate via `MembershipQueryPort`. `VIEWER` role is read-only — tenant write use cases reject it.

## Tenancy Use Cases (Organization Management Context)

### Use Case: Create Organization

```
CreateOrganizationUseCase.execute({ actorId, name, slug })

  1. Validate slug is unique (OrganizationRepository.findBySlug)
  2. Normalize + reserve the default subdomain (= slug, Subdomain VO rules:
       lowercase [a-z0-9-], 3–63 chars, not in reserved list); append "-<rand>"
       on collision (OrganizationRepository.findBySubdomain)
  3. Organization.create({ name, slug, ownerId: actorId, subdomain })
     + generate DomainVerificationToken (unused until custom domain requested)
  4. Persist Organization
  5. Create OrganizationMembership(actorId, role=OWNER)
  6. Raise OrganizationCreatedEvent
  7. Return Organization (with tenantUrl = https://{subdomain}.{APP_BASE_HOST})
```

> On user signup the Auth module calls this internally to auto-provision the user's **personal organization** (`OrganizationCreatedEvent`).

### Use Case: Manage Tenant Domain

> Behavior: **every organization gets a default subdomain at creation**; an OWNER/ADMIN can later customize it or add a **custom domain** that only becomes active after DNS verification. The subdomain/custom domain are the values `resolveTenant` matches on the `Host` header.

```
UpdateSubdomainUseCase.execute({ orgId, actorId, subdomain })
  0. Require role ≥ ADMIN (MembershipQueryPort — reject VIEWER)
  1. Validate Subdomain VO rules + reserved names; OrganizationRepository.findBySubdomain → 409 if taken
  2. Organization.updateSubdomain(subdomain)
  3. Persist; raise SubdomainChangedEvent (triggers URL re-linking / CDN invalidation)

RequestCustomDomainUseCase.execute({ orgId, actorId, domain })
  0. Require role ≥ ADMIN
  1. Validate CustomDomain VO (valid FQDN, not equal to a base host/wildcard, not already in use:
       OrganizationRepository.findByCustomDomain → 409)
  2. Generate a fresh DomainVerificationToken, e.g. 32-hex
  3. DomainVerificationPort.getTxtRecord(domain) → returns the exact TXT record to publish:
       record name  _taskflow-verification.<domain>
       record value  <token>
  4. Persist { customDomain, customDomainVerificationToken } — customDomainVerifiedAt stays null
  5. Return instructions (DNS record + note DNS can take minutes to propagate)

VerifyCustomDomainUseCase.execute({ orgId, actorId })
  0. Require role ≥ ADMIN
  1. Load Organization; if no pending customDomain → 404
  2. DomainVerificationPort.checkTxtRecord(domain, token)
       — queries DNS for TXT under _taskflow-verification.<domain>
       — matches ANY record containing the token (case-insensitive)
  3. Match → set customDomainVerifiedAt = now; raise CustomDomainVerifiedEvent; return tenantUrl
     No match → 409 "DNS record not found or not propagated yet"
  4. customDomain overrides the subdomain in resolveTenant from now on

RemoveCustomDomainUseCase.execute({ orgId, actorId })
  0. Require role ≥ ADMIN
  1. Clear customDomain* fields; raise CustomDomainRemovedEvent
  2. Tenant reverts to https://{subdomain}.{APP_BASE_HOST}
```

> **DnsVerificationPort** (`organization-management/domain/ports/`) is a normal driven port like a repository: the use case never talks to DNS directly. The adapter (`infrastructure/verification/dns-verification.adapter.ts`) implements it via Node's `dns/promises` (TXT lookup) — no external dependency required for DNS readback; an optional provider adapter (Route53/Cloudflare) can be swapped in later to also *create* records automatically.

### Use Case: Add Member

```
AddMemberUseCase.execute({ orgId, actorId, userId, role })

  1. Verify actor membership + role ≥ ADMIN (MembershipQueryPort via middleware + use case)
  2. Load Organization aggregate
  3. Organization.addMember(userId, role) — unique (orgId, userId)
  4. Persist OrganizationMembership
  5. Raise MemberAddedEvent
  6. Return membership
```

### Use Case: List Members

```
ListMembersUseCase.execute({ orgId, actorId })
  → OrganizationMembership[] (any member may list)
```

### Use Case: Update Member Role / Remove Member

```
UpdateMemberRoleUseCase.execute({ orgId, actorId, userId, newRole })
  → requires actor role OWNER/ADMIN; cannot demote/remove the OWNER
RemoveMemberUseCase.execute({ orgId, actorId, userId })
  → requires OWNER (or self); last OWNER cannot be removed
```

## Use Case: Create Project

```
CreateProjectUseCase.execute({ orgId, actorId, name, description?, stages?: StageDraft[] })

  0. Verify (orgId, actorId) membership (MembershipQueryPort) — reject VIEWER
  1. If stages omitted → 5 default Stages: ["Backlog", "To Do", "In Progress", "In Review", "Done"]
       — mark the last stage isDone = true
  2. Project.create({ orgId, ownerId: actorId, name, description, stages })
       — same invariants as manual stage management: max 20, unique names,
         gap-free positions, exactly one terminal isDone stage
  3. Persist via ProjectRepository
  4. Raise ProjectCreatedEvent
  5. Return Project aggregate with Stages
```

**Boundary**: Project Management Context

## Use Case: Generate Project Blueprint (AI-Assisted Setup)

```
GenerateProjectBlueprintUseCase.execute({ orgId, actorId, prompt, projectType? })

  0. Verify (orgId, actorId) membership (MembershipQueryPort) — reject VIEWER
  1. Validate input: prompt non-empty, ≤ 2000 chars
  2. Call ProjectBlueprintGeneratorPort.generate({ prompt, projectType })
       — adapter talks to the LLM (see 06-ai-project-blueprint.md)
  3. If result is null OR fails Project.create() invariants:
       → fall back to the default 5-stage blueprint
  4. Return ProjectBlueprint { name, description?, stages[] }
       — nothing is persisted; the blueprint is a transient proposal
```

**Boundary**: Project Management Context. The AI is behind `ProjectBlueprintGeneratorPort` (domain port) implemented in `infrastructure/ai/` — domain/application have no LLM SDK dependency. The blueprint itself is a **Value Object**, never an aggregate or a table.

> **Create-from-blueprint**: the client confirms/edits the blueprint, then posts it to `CreateProjectUseCase` (`POST /api/organizations/:orgId/projects`), which accepts an optional `stages[]`. There is no separate "blueprint" entity to persist.

## Use Case: Add Stage to Project

```
AddStageUseCase.execute({ orgId, actorId, projectId, input })

  0. Verify (orgId, actorId) membership (MembershipQueryPort) — reject VIEWER
  1. Load Project aggregate
  2. Project.addStage(name, color) — business rule: max 20 stages
  3. Persist via ProjectRepository
  4. Return updated Project with new Stage
```

**Business Rules** (in Project entity):
- Maximum 20 stages per project
- Stage position is auto-assigned (gap-free)
- Stage name must be unique within project
- Exactly one stage should be marked `isDone` (the terminal column)

## Use Case: Reorder Stage

```
ReorderStageUseCase.execute({ orgId, actorId, projectId, stageId, newPosition })

  0. Verify (orgId, actorId) membership (MembershipQueryPort) — reject VIEWER
  1. Load Project aggregate
  2. Project.reorderStage(stageId, newPosition) — shifts positions
  3. Persist via ProjectRepository
  4. Raise StageReorderedEvent
  5. Return updated Project
```

## Use Case: Create Task

```
CreateTaskUseCase.execute({ orgId, actorId, projectId, input })

  0. Verify (orgId, actorId) membership (MembershipQueryPort) — reject VIEWER
  1. Validate Project exists AND project.organizationId === orgId
       (cross-module read → ProjectQueryPort)
  2. Validate Stage exists AND stage.organizationId === orgId (if stageId provided → StageQueryPort)
  3. Create Task aggregate root
  4. If assigneeIds provided: create TaskAssignment entities
  5. Persist via TaskRepository
  6. If assigned: raise TaskAssignedEvent
  7. Return Task aggregate
```

**Boundary**: Task Board Context (references Project/Stage by ID only)

## Use Case: Move Task Between Stages (Drag & Drop)

```
MoveTaskUseCase.execute({ orgId, actorId, taskId, targetStageId, targetPosition })

  0. Verify (orgId, actorId) membership (MembershipQueryPort) — reject VIEWER
  1. Load Task aggregate
  2. Validate target Stage belongs to the same Project and same org
       (cross-module read → StageQueryPort returns organizationId)
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
// Atomic position shift within a stage (a persistence-transactional concern)
async shiftPositions(stageId: string, fromPosition: number, toPosition: number) {
  // Decrement positions after old position in source stage
  // Increment positions at/beyond target position in target stage
}
```

> Position renumbering is a **persistence-adapter** concern (atomic DB transaction). The ordering *invariant* (no gaps, valid target/target-stage) is owned by the Task aggregate + application validation; the repository adapter implements the physical shift via the `TaskRepositoryPort`. The use case never sees SQL.

## Use Case: Reorder Task Within Stage

```
ReorderTaskUseCase.execute({ orgId, actorId, taskId, newPosition })

  0. Verify (orgId, actorId) membership (MembershipQueryPort) — reject VIEWER
  1. Load Task aggregate
  2. Validate task is in same stage
  3. Task.reorder(newPosition) — shifts positions within stage
  4. Persist via TaskRepository
  5. Return updated Task
```

## Use Case: Assign Task

```
AssignTaskUseCase.execute({ orgId, actorId, taskId, userIds[] })

  0. Verify (orgId, actorId) membership (MembershipQueryPort) — reject VIEWER
  1. Load Task aggregate
  2. Validate Users exist (cross-module read → UserQueryPort)
  3. Validate assignees are members of the same org (MembershipQueryPort)
  4. Create TaskAssignment entities (within Task aggregate)
  5. Persist via TaskRepository
  6. Raise TaskAssignedEvent for each new assignment
  7. Return updated Task with assignments
```

## Use Case: Add Comment

```
AddCommentUseCase.execute({ orgId, actorId, taskId, content })

  0. Verify (orgId, actorId) membership (MembershipQueryPort) — reject VIEWER
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

> The Reports context is a **query/read side**. It has NO aggregates and issues NO write commands. It builds projections by reading the `Task`, `TaskAssignment`, and `Stage` tables (optionally cached in Redis or a materialized snapshot). **Scoping**: every report runs inside `/:orgId` and validates membership via `MembershipQueryPort`; project-level reports also validate the project belongs to `:orgId` via `ProjectQueryPort`. Because they are read-only and lag-tolerant, report queries are served from **read replicas** (see [07-infrastructure-scaling.md](07-infrastructure-scaling.md)).

### Use Case: Get Project Dashboard Summary

```
GetProjectSummaryUseCase.execute(projectId, range)

  1. Load project (verify ownership → ProjectQueryPort)
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
  WHERE stage.project_id = :projectId
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

### Use Case: Get Organization (Tenant) Dashboard

```
GetOrganizationSummaryUseCase.execute({ orgId, actorId, range })

  Aggregates across ALL projects in the organization:
    projectCount   = COUNT(projects where organization_id = :orgId)
    totalTasks     = COUNT(tasks where organization_id = :orgId)
    openTasks      = SUM tasks not completed
    overdueTasks   = COUNT(dueDate < now AND not completed)
    completionRate = completed / total * 100
    activityTrend  = last 7 days completions (for sparkline)
```

### Use Case: Get Organization Tasks By Stage

```
GetOrganizationTasksByStageUseCase.execute({ orgId, actorId })

  SELECT s.name, s.position, COUNT(t.id) as count
  FROM stage s
  LEFT JOIN task t ON t.stage_id = s.id
  WHERE s.organization_id = :orgId
  GROUP BY s.id, s.name, s.position
  ORDER BY s.position
```

### Use Case: Get Organization Velocity / Throughput

```
GetOrganizationVelocityUseCase.execute({ orgId, actorId }, { range: 'week' })

  SELECT date_trunc(:bucket, t.completed_at) AS bucket, COUNT(t.id) AS completed
  FROM task t
  WHERE t.organization_id = :orgId
    AND t.completed_at IS NOT NULL
    AND t.completed_at BETWEEN :from AND :to
  GROUP BY bucket ORDER BY bucket
```

### Use Case: Get Organization Overdue / Upcoming

```
GetOrganizationOverdueTasksUseCase.execute({ orgId, actorId })
  → SELECT tasks WHERE organization_id = :orgId AND due_date < now AND completed_at IS NULL
GetOrganizationUpcomingTasksUseCase.execute({ orgId, actorId }, { days })
  → SELECT tasks WHERE organization_id = :orgId AND due_date BETWEEN now AND now + :days
```

### Use Case: Get Organization Workload / Assignee Activity

```
GetOrganizationWorkloadUseCase.execute({ orgId, actorId })
  → per-assignee open task counts across the org (same shape as project workload,
    filtered by t.organization_id = :orgId)
GetOrganizationAssigneeActivityUseCase.execute({ orgId, actorId }, { range })
  → completed tasks per assignee within a time window, org-wide
```

> Note: each org report use case verifies membership (≥ MEMBER) up front via `MembershipQueryPort`, then queries by `organization_id`. All report SQL filters by `organization_id` so data never leaks across tenants.

## Reports Caching Strategy

| Strategy | When | Mechanism |
|----------|------|-----------|
| **Direct SQL aggregation** | Default, small/medium data | Prisma `groupBy` / raw `pg` queries |
| **Redis cache** | Frequent dashboard loads | Cache JSON by `(orgId, projectId, range, filters)`; TTL 5 min |
| **Materialized snapshot** | Large datasets / heavy velocity | Worker maintains `TaskSnapshot` from `TaskMoved`/`TaskCompleted` events |

**Cache-aside pattern**:
```
1. Check Redis key report:org:{orgId}:{report}:{range}   (project reports: report:project:{id}:...)
2. Hit → return cached JSON
3. Miss → run aggregation, store, return
4. Invalidate on TaskMoved/TaskCompleted (or TTL)
```

## Security Considerations

- All endpoints require JWT authentication (`authenticate` middleware)
- Every `/organizations/:orgId/...` route runs `authorizeMembership({ orgId, minRole })` — rejects non-members; `VIEWER` is read-only
- Project access: only members of the org can access, writes require ADMIN/MEMBER — `authorizeProject` middleware
- Task move: validate stage belongs to same project and same org
- Stage delete: validate not the last stage (min 1 required)
- Rate limiting: reuse existing `rateLimiter` middleware
