# AI Planning - Task Management System

Senior-level architecture plan using **Domain-Driven Design (DDD)** for a Kanban-style task management API.

## Contents

| File | Description |
|------|-------------|
| [01-domain-model.md](01-domain-model.md) | ERD, Aggregates, Entities, Value Objects, Prisma schema |
| [02-api-design.md](02-api-design.md) | All REST endpoints with request/response |
| [03-module-architecture.md](03-module-architecture.md) | DDD Bounded Contexts, Use Cases, SOLID, file structure |
| [04-business-logic.md](04-business-logic.md) | Core flows: project creation, task move, stage reorder, reports |
| [05-implementation-phases.md](05-implementation-phases.md) | Phased rollout plan, security, open questions |

## Architecture Summary

```
src/contexts/
├── project-management/        — Project, Pipeline, Stage (Aggregate)
│   ├── domain/                — Entities, Value Objects
│   ├── application/           — Use Cases
│   ├── infrastructure/        — Prisma repositories
│   └── interfaces/            — HTTP layer (Controller, Validator, Routes)
├── task-board/                — Task, Assignment, Comment, Attachment (Aggregate)
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── interfaces/
└── reports/                   — Dashboard queries (Read Model, read-only)
    ├── domain/                — Read Models
    ├── application/           — Report/query use cases
    ├── infrastructure/        — SQL aggregations + Redis cache
    └── interfaces/            — HTTP layer
```

**Key Principle**: Business rules live in **domain entities** (write side). The **Reports** context is a read-only query side that builds dashboard projections from task data, optionally cached in Redis or a materialized snapshot.
