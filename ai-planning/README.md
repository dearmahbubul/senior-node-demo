# AI Planning - Task Management System

Architecture plan using **Modular Monolith + Hexagonal (Ports & Adapters) + DDD** for a Kanban-style task management API (ClickUp-style).

## Contents

| File | Description |
|------|-------------|
| [01-domain-model.md](01-domain-model.md) | ERD, Aggregates, Entities, Value Objects, Prisma schema |
| [02-api-design.md](02-api-design.md) | All REST endpoints with request/response |
| [03-module-architecture.md](03-module-architecture.md) | Modules, Ports & Adapters, Use Cases, SOLID, file structure |
| [04-business-logic.md](04-business-logic.md) | Core flows: project creation, task move, stage reorder, reports |
| [05-implementation-phases.md](05-implementation-phases.md) | Phased rollout plan, testing strategy, open questions |
| [06-ai-project-blueprint.md](06-ai-project-blueprint.md) | AI-assisted project setup: generate project + stages blueprint from a prompt |
| [07-infrastructure-scaling.md](07-infrastructure-scaling.md) | Multi-tenant isolation + primary/replica DB read scaling |

## Architecture Summary

```
src/modules/
├── organization-management/       Module 1: Tenancy — Organizations + Membership
│   ├── domain/                    — Organization, OrganizationMembership, roles
│   ├── application/               — Org + membership use cases
│   ├── infrastructure/            — Prisma adapters
│   ├── interfaces/                — Driving adapters (HTTP)
│   └── index.ts                   — Module barrel (+ `organizationQueries` facade)
├── project-management/            Module 2: Projects + Stages
│   ├── domain/                    — Entities, VOs, Events, PORTS
│   ├── application/               — Use Cases
│   ├── infrastructure/            — Prisma adapters (implements ports)
│   ├── interfaces/                — Driving adapters (HTTP, queue consumers)
│   └── index.ts                   — Module barrel (public API)
├── task-board/                    Module 3: Tasks, Assignments, Comments
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   ├── interfaces/
│   └── index.ts
├── reports/                       Module 4: Dashboard & Analytics (read-only)
│   ├── domain/                    — Read Models
│   ├── application/               — Report query use cases
│   ├── infrastructure/            — SQL adapters + Redis cache adapter
│   ├── interfaces/                — HTTP layer
│   └── index.ts
└── auth/                          Module 5: Auth (existing — refactor)
```

**Key Principles**:
- **Domain at center**: Business rules live in entities, not services. Domain depends on nothing — no Prisma, Express, or framework types (enums like `TaskPriority` are domain-owned unions, mapped to Prisma only in adapters).
- **Ports in domain, adapters in infrastructure**: Repository/event interfaces (`ports/`) defined in domain, implemented as Prisma/RabbitMQ classes in `infrastructure/`.
- **Composition root** (`src/common/di/container.ts`): Wires adapters into use cases. Only place that knows all concrete implementations.
- **Module boundaries enforced at import level**: Cross-module sync reads use **consumer-owned query ports** implemented as gateways in the calling module's `infrastructure/gateways/` (one-way dependency, never cyclic).
- **Clean Architecture layering per module**: `domain/` (entities + ports) → `application/` (use cases) → `interfaces/` (driving adapters) → `infrastructure/` (driven adapters); dependencies point strictly inward.
- **Reports is read-only**: Builds dashboard projections from task data via SQL aggregation. No writes to task/project aggregates.
- **AI is just another driven adapter** (see `06`): an OpenAI/LLM provider implements the `ProjectBlueprintGeneratorPort` behind `infrastructure/ai/`; the generated blueprint is a transient Value Object, never persisted until the user confirms creation.
- **Multi-tenant by default** (see `01`): every tenant-owned row carries `organizationId`; routes are nested under `/organizations/:orgId` with `authorizeMembership`; roles OWNER/ADMIN/MEMBER/VIEWER; a personal organization is auto-created per user on signup.
- **Host-based tenant domains** (see `01`/`02`): every organization gets a **default subdomain** on creation (`acme.app.taskflow.app`); admins can later add a **custom domain** that activates only after DNS-TXT verification — `resolveTenant` maps the `Host` header to the organization.
- **DB read scaling via replicas** (see `07`): Prisma `replicas` routes read-only queries (reports) to read replicas while writes/transactions stay on the primary.
