# Senior Node Demo

A production-shaped REST API built with **Node.js 22 + TypeScript + Express 5**, used as a learning ground for senior-level backend practices: layered architecture, typed error handling, validation, auth, queues, observability, and containerized deployment.

## Stack

| Layer      | Technology                                        |
| ---------- | ------------------------------------------------- |
| Runtime    | Node.js ≥ 22.16, TypeScript (strict)              |
| HTTP       | Express 5                                         |
| ORM        | Prisma 7 (`prisma-client` generator) + PostgreSQL |
| Validation | Zod v4 (request DTOs)                             |
| Auth       | JWT (HS256, explicit algorithm pinning)           |
| Cache/Limits | Redis (rate-limit store)                        |
| Queue      | RabbitMQ (amqplib)                                |
| Logging    | Pino (+ pino-http, auth headers redacted)         |
| Async      | RabbitMQ worker (`npm run worker`) → email notifications (Nodemailer; Mailpit for local SMTP) |
| API docs   | OpenAPI 3 via `@asteasolutions/zod-to-openapi`    |
| Infra      | Docker, docker-compose, kind (Kubernetes)         |

## Architecture

```
src/
├── server.ts              # bootstrap + graceful shutdown (SIGTERM/SIGINT)
├── app.ts                 # middleware pipeline assembly
├── config/                # env validation (Zod, fail-fast at boot)
├── prisma/client.ts       # single PrismaClient instance (@db alias → src/prisma)
├── generated/prisma/      # Prisma-generated client (@generated alias)
├── common/
│   ├── errors/            # AppError base + NotFoundError / ValidationError
│   ├── middleware/        # authenticate, validateRequest, rateLimiter, globalErrorHandler
│   ├── queue/             # RabbitMQ connection wrapper
│   └── utils/             # asyncHandler, helpers
└── modules/
    ├── auth/  ├── tasks/  └── users/
        each: routes → controller → service → repository
               + validator (input DTO) + resource (output DTO)
```

**Request flow:** `routes` (wiring + validation) → `controller` (HTTP in/out, maps via Resource) → `service` (business rules, throws domain errors) → `repository` (Prisma only). Errors bubble up to `globalErrorHandler`; unknown internals are masked in production responses.

**DTO convention:** Zod schemas in `*.validator.ts` are the *input* DTOs (validated + inferred types). `*.resource.ts` are the *output* DTOs — the only layer allowed to shape JSON that leaves the API. Nothing from a repository ever reaches the wire directly (e.g. `passwordHash` cannot leak).

## Getting started

```bash
npm install
cp .env.example .env        # then set JWT_SECRET

# infrastructure (Postgres, Redis, RabbitMQ)
docker compose up -d db redis rabbitmq

# database
npm run db:migrate
npm run db:seed             # faker-based seed data

npm run dev                 # API server (tsx watch) on http://localhost:3010
npm run worker              # notification worker (email queue consumer)

# optional: local SMTP inbox to SEE sent emails -> http://localhost:8030
docker compose --profile mail up -d mailpit
# then set SMTP_HOST=localhost SMTP_PORT=1030 in .env
```

## Scripts

| Script                | Purpose                          |
| --------------------- | -------------------------------- |
| `dev`                 | Dev server with watch mode       |
| `build` / `start`     | Compile (`tsc` + path aliases) and run dist |
| `typecheck`           | `tsc --noEmit`                   |
| `format` / `format:check` | Prettier                     |
| `db:migrate` / `db:seed` / `db:reset` / `db:studio` | Prisma workflows |

## API surface

- `GET  /health` — liveness probe
- `GET  /docs` — Swagger UI · `GET /openapi.json`
- `POST /api/auth/login` (rate-limited: 5 / 15 min per IP via Redis)
- `GET  /api/auth/me` (JWT required)
- `POST /api/users`, `GET /api/users/:id` (JWT required)
- `POST /api/tasks`, `GET /api/tasks`, `GET /api/tasks/:id`, `PATCH /api/tasks/:id/status`, `PATCH /api/tasks/:id/assign`
- Nested attachments (JWT required): `POST|GET /api/tasks/:taskId/attachments`, `GET /api/tasks/:taskId/attachments/:id/download`, `PATCH|DELETE /api/tasks/:taskId/attachments/:id` — deleting a task cascades to its attachments
- `POST /api/tasks` accepts **either** JSON *or* multipart (`data` JSON part + `attachments[]` files) for create-with-attachments in one request
- Attachments upload real binaries (Multer, memory-parsed) to the driver selected by `STORAGE_DRIVER`: `local` filesystem or `s3` (AWS S3 / MinIO compatible). Metadata (size/mime) comes from the parsed bytes — never from client input. Deleting an attachment removes both the DB row and the stored object; failed inserts roll back stored files.

All `/api` responses share one envelope:

```json
{ "success": true, "message": "...", "data": {}, "meta": { "timestamp": "..." } }
```

## Full stack (production image)

```bash
JWT_SECRET=<min 16 chars> docker compose up --build
```

Includes Dozzle (logs at :9999), Redis Commander (:8081), and pgAdmin (:5050).
