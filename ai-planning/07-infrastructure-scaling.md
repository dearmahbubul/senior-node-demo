# 07 - Infrastructure Scaling: Primary / Replica Databases

## Vision

As the platform grows past a single tenant, read traffic (reports, dashboards, list views) tends to dominate write traffic (task moves, stage changes). We use an **Amazon RDS/Aurora Postgres primary + N read replicas** setup mirrored by **Prisma's `replicas` option**: the ORM automatically spreads reads across **all** configured replicas (round-robin), while every write stays on the primary.

```
                 ┌──────────────────────────────────────────┐
                 │               Client                      │
                 └──────────────────┬───────────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │    App (Express)   │
                          │  common/di/container│
                          └─────────┬─────────┘
                 ┌───────────────────┼───────────────────┐
                 │ Prisma `replicas` (round-robin reads) │
                 ▼                  ▼                ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │   PRIMARY    │◄──│  REPLICA 1   │◄──│  REPLICA 2   │◄──│ ... REPLICA N│
   │  (writes +   │   │    (reads)   │   │    (reads)   │   │    (reads)   │
   │  $transaction)│  └──────────────┘   └──────────────┘   └──────────────┘
   └──────────────┘        ▲
                           └─────────────────────────────── Postgres streaming
                             (all replicas apply the same WAL from the primary)
```

> **The write path is a single node; the read path is a horizontal fleet.** Adding a replica is cheap and near-instant, so read capacity is scaled independently of write capacity.

## Decision: master/slave (primary replica) yes — via Prisma `replicas`

| Option | Verdict | Reason |
|--------|---------|--------|
| Prisma read replicas | **Yes** | Built into recent Prisma versions: `replicas: [ ... ]` on the PrismaClient; reads round-robin to replicas, writes always go to `DATABASE_URL`. Zero SQL changes required. |
| Dedicated `QueryClient` per adapter | Avoid | Would require every read adapter to pick a "read" client — more plumbing; Prisma already handles it. |
| Materialized dashboard tables only | Also useful | Complements replicas for heavy velocity queries (see `04-business-logic.md`); still needs replicas for the long-tail of read queries. |

## Prisma Setup

```typescript
// prisma/client.ts (or common/db)
import { PrismaClient } from '@prisma/client';

const replicaUrls = (process.env.DATABASE_REPLICA_URLS ?? '')
  .split(',')
  .map((u) => ({ url: u.trim() }))
  .filter((u) => u.url);

export const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },            // PRIMARY (writes + transactions)
  },
  replicas: replicaUrls,                              // 1..N read replicas
});
```

- `DATABASE_URL` — the **primary**; all `create`/`update`/`delete` and `$transaction` calls land here.
- `DATABASE_REPLICA_URLS` — comma-separated list of `1..N` read replicas; **each plain read query is routed to one replica (Prisma round-robins across the whole list)**.
- The **Reports module's** `PrismaReportQueryAdapter` and the `OrganizationQueryPort`/`MembershipQueryPort` gateways are pure-read and automatically benefit — no code changes.
- PgBouncer sits in front of both the primary and every replica. Use **transaction pooling** for the primary (serves `$transaction` workloads) and a **session/statement pooling** profile for replicas if long report queries are used.

> **Two ways to scale replicas:**
> 1. **Static list (simple)**: add a URL to `DATABASE_REPLICA_URLS` and redeploy. Fine up to ~2–4 replicas.
> 2. **Single reader DNS endpoint (recommended for scale)**: point Prisma at **one** reader endpoint that the DB service rotates across replicas. **Aurora** exposes a built-in **reader endpoint** that load-balances all read traffic across replicas automatically; RDS lets you create a **custom endpoint** pointing at a replica fleet. Then scaling = adding a replica **with no app changes, no redeploy, no round-robin skew**.

## Multiple Read Replicas (Read Scaling)

### What actually scales with more replicas

| Query type | Scales with replicas? | Notes |
|------------|----------------------|-------|
| Reports aggregations (`groupBy`, `COUNT`, `date_trunc`, velocity, aging) | **Yes — the main win** | Read-heavy; each dashboard query lands on one replica, so concurrent dashboards spread across the fleet |
| Board/list lookups (project, stage, task by PK + pagination) | Yes | Cheap already; replicas absorb the volume as tenants grow |
| `authorizeMembership` / `resolveTenant` reads | **No — stay on primary** | Consistency-gating reads must not touch lagged replicas |
| Writes, `$transaction`, `shiftPositions` | **No** | Always the single primary; if writes saturate it, scale the primary instance (`db.*`), not replicas |

> More replicas multiply read capacity; they do **not** fix a slow query. Queries are still tuned with indexes (see `@@index([organizationId, ...])`), and replicas just let them run in parallel without contending for the primary.

### Replica selection & consistency across the fleet

- **Round-robin**: Prisma hands each read to the next replica in the list (`1 → 2 → … → N → 1`). A single dashboard request may read from a *different* replica per query — acceptable because dashboards tolerate eventual consistency (TTL 5 min).
- **Independent lag**: every replica replays the primary's WAL on its own clock, so each has its own lag. Typical RDS lag is 100–500 ms; alert at > 5 s.
- **Consistency-critical reads never use replicas** (primary-only rule from the table below). For a one-off "exact" read (e.g., export taken before finalizing billing), run it against the primary — no special API needed, just don't route it to a replica.
- If an individual report ever needs a tight snapshot across multiple queries, run that **one report** against the primary (or a dedicated replica pinned for the request) rather than the round-robin fleet.

### When and how to add a replica

```
Trigger conditions (any):
  • average replica CPU > 70% at peak
  • read QPS keeps climbing while writes stay flat
  • report p95 latency degrading / replica connection saturation

Steps:
 1. Provision a new read replica (AWS RDS/Aurora) — usually minutes.
 2. Wait for it to reach "in sync" (lag ~0).
 3. Route to it:
      • Aurora: it joins the existing reader endpoint automatically → no app change.
      • RDS static list: append the URL to DATABASE_REPLICA_URLS and redeploy.
 4. Watch lag + CPU for 15 min; keep or revert.
```

### Failure modes

| Failure | Behavior | Response |
|---------|----------|----------|
| One replica goes down | Aurora reader endpoint/RDS DNS drops it; Prisma may hit it once before discovery | Reads continue on remaining replicas; alert; re-create replica |
| Lag storm (replica far behind) | Dashboards return stale data, not errors | Alert; pause heavy jobs against that replica; let it catch up |
| Primary fails | Promote most up-to-date replica to primary (RDS automatic); `DATABASE_URL` re-points; **replica fleet rebuilds streaming from the new primary** | Failover drill + read replica re-provisioning plan |

## Read / Write Routing Rules

| Operation | Client | Consistency required | Notes |
|-----------|--------|----------------------|-------|
| All writes (`createProject`, `moveTask`, …) | `prisma` (primary) | Strong | Never accidentally issue a write that Prisma can route to a replica — this is inherent, Prisma only sends writes to primary |
| `TaskRepository.shiftPositions` renumbering | `prisma.$transaction` | Strong | Must be atomic on the primary |
| Login / auth (`UserQuery`) | Primary | Strong | A user must be able to read what s/he just wrote; also session-critical |
| Project/Stage/Task lookup while acting | Primary | Strong | "Write-then-read" inside the same request |
| Reports & dashboards (`reports` module) | Replica (automatic) | **Eventual** — explicitly OK | Lag up to a few seconds is acceptable for charts/counts |
| Organization/membership reads in `authorizeMembership` | Primary | Strong | Authorization decisions must not read a lagged replica |
| Tenant-domain lookup in `resolveTenant` (`findByHost`) | Primary | Strong | Domain ownership gates every request; a lagged replica could route one tenant's host to another |
| Subdomain/custom-domain uniqueness checks on create/update | Primary | Strong | Unique indexes live on the primary; `$transaction`/write path |
| List/export jobs, reads of audit data (future) | Replica | Eventual | Bulk scans avoid competing with writes |

> **Rule of thumb**: anything that gates a write decision (membership, project ownership, unique constraints) or is read immediately after a write must hit the **primary**. Read-only analytics and lookups may use replicas.

## Consistency & Read-After-Write

- **`authorizeMembership` reads the primary.** If it used a replica, a just-created org/project could be denied because the replica had not caught up.
- **Project creation → redirect to project page: read primary.** `GetProjectUseCase` after `CreateProjectUseCase` must see its own write (immediate consistency). In Prisma this is automatic because both go through the same client, which sends writes to primary — but the **read after write must not go through a replica path**; keep it on the same client.
- **Dashboards tolerate lag.** Reports refresh on `TaskMoved`/`TaskCompleted` events or TTL (default TTL 5 min); a replica lag of 100–500 ms on typical RDS setups is invisible.
- **Position renumbering** (`moveTask`, `reorderTask`) is wrapped in `$transaction` on the primary — replicas only ever see the committed result.

## Multi-Tenant Domains (Host-Based Routing + TLS)

- **Default subdomain**: every organization is reachable at `https://<subdomain>.<APP_BASE_HOST>`. The load balancer uses a **wildcard listener** on `*.APP_BASE_HOST` (wildcard TLS cert) so no per-tenant setup is needed. A **wildcard CNAME**-style record (`*` → `APP_BASE_HOST`) or `route53` alias handles DNS.
- **Custom domains** (after TXT verification): the customer points `CNAME app.acme.com → APP_BASE_HOST` (or an A/ALIAS record); we terminate TLS via **per-domain certificates** (ACME/Let's Encrypt DNS-01 or the LB's built-in cert provisioning), which requires automatic discovery of `Host` headers that carry a verified `Organization.customDomain`.
- **Edge resolution**: `resolveTenant` reads the primary DB, so the LB must not silently serve a stale cache. It is safe to cache **orgId + domain** in Redis after a successful match (TTL ~1 min, evicted on `SubdomainChangedEvent`/`CustomDomainVerifiedEvent`/`CustomDomainRemovedEvent`) — DNS-TXT verification and ownership checks always fall back to the primary.
- **Unauthenticated hosts**: unknown `Host` → same 404/redirect regardless of which tenant's subdomain was requested; never leak the existence of other tenants.
- **Cookies/security**: set `Cookie` `Domain`/`Secure` appropriately per tenant origin; use `SameSite=Lax` and `Secure` (TLS everywhere).

## Replica Provisioning (RDS)

| Setting | Value |
|---------|-------|
| Engine | PostgreSQL (recent stable, `aurora`-optional) |
| Replication | AWS-managed **streaming replication** (physical, using the logical replica automatically created with RDS read replicas) |
| Failover | RDS automatic: promote a replica then update the primary endpoint in the app (`DATABASE_URL`); Prisma `replicas` just re-points |
| Read scale | Horizontal fleet: `1..N` replicas; read load spread by Prisma round-robin (static list) or auto by the DB reader endpoint (Aurora) with zero app changes |
| Availability | Replicas sit in different AZs; primary has Multi-AZ storage |

> If we adopt **Aurora PostgreSQL** in the future, replicas share the same storage and have <50 ms typical lag with auto-failover — the Prisma config above is unchanged.

## Monitoring & Alerts

- Track **per-replica replication lag** (`pg_stat_replication` → `replay_lag`/`write_lag`/`flush_lag`) — alert at > 5 s on **any** replica.
- Monitor **each replica's** CPU / connections / read IOPS; run the "add a replica" checklist before report latency degrades.
- Watch **replica fleet membership** — a replica dropping out of the reader endpoint should alarm immediately.
- Validate that no writes accidentally reach replicas (grant replicas `readonly` role as defense in depth).

## Testing

- **Integration**: create prisma clients pointing at primary vs. each replica; assert a committed write eventually appears on every replica (allow lag polling).
- **Fleet spread**: assert reads are distributed across ≥ 2 replicas (round-robin) — e.g., a loop of `count()` queries touches more than one replica (check via `pg_stat_activity`/replica access logs).
- **Read-after-write**: exercise `moveTask` → immediate `getTask` on the same client (primary); assert no stale read.
- **Replica failure**: stop one replica mid-read; assert reads continue on the remaining replicas (Aurora reader endpoint) with no error and no write impact.
- **Failover drill**: promote a replica, re-point `DATABASE_URL`, verify writes continue; verify the replica fleet rebuilds from the new primary.
- **Report accuracy**: seed data, run report queries against each replica, compare counts against a primary query.