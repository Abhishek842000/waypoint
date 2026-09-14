# Waypoint

Multi-tenant incident response and public status pages — a PagerDuty + Statuspage hybrid.

Organizations define services and on-call rotations. When something breaks, an incident is opened, responders act on a real state machine, and an **unauthenticated** status page reflects that org’s current and historical status. Every query is tenant-scoped at the data-access layer. Every mutating endpoint is gated by RBAC on the API, not by frontend route guards.

> Phase 1: services, rotations (weekly round-robin pointer via BullMQ), escalation policy steps. Incident auto-escalation timers are next — still not `setTimeout`.

## Architecture

```mermaid
flowchart LR
  subgraph clients [Clients]
    Web["Next.js dashboard<br/>authenticated"]
    Status["/status/:orgSlug<br/>public, no dashboard layout"]
    Ext["External monitors<br/>API key"]
  end

  subgraph edge [API]
    Auth["AuthGuard<br/>session JWT or API key"]
    RBAC["PermissionsGuard<br/>@RequirePermission"]
    Tenant["tenantDb()<br/>Prisma extension + ALS"]
    Nest["NestJS /v1"]
  end

  subgraph data [Data plane]
    PG[(Postgres)]
    Redis[(Redis / BullMQ)]
    Worker["Worker process<br/>escalation + notify"]
  end

  Web --> Auth
  Status --> Nest
  Ext --> Auth
  Auth --> RBAC --> Tenant --> PG
  Worker --> Redis
  Worker --> Tenant
```

| Layer | Choice | Why |
| --- | --- | --- |
| API | NestJS | Guards/decorators map 1:1 onto RBAC; modules match the domain |
| DB | Prisma | Client extension can *force* `orgId` onto every tenant query |
| Auth | Nest JWT cookie + API keys | Auth lives on the API (source of truth for actor/org/scopes). Auth.js would split session auth into Next and leave API keys on Nest |
| Jobs | BullMQ worker | Escalation must survive process restart — never `setTimeout` |
| Frontend | Next.js App Router | Dashboard route group is structurally separate from `/status/[orgSlug]` |
| Monorepo | pnpm workspaces | Solo-dev velocity; Turbo can land later if build graphs hurt |

Tenancy is not an `org_id` filter sprinkled in controllers. `tenantDb()` refuses to run without AsyncLocalStorage context and **overwrites** any caller-supplied `orgId` on create.

## Local setup

Requires Docker, Node 22, and pnpm 9. Postgres is published on **host port 5433** so it does not collide with a local Postgres on 5432 (inside Compose the DB still listens on 5432).

```bash
cp .env.example .env
docker compose up -d postgres redis
pnpm install
pnpm db:migrate:deploy   # after first install, or: pnpm --filter @waypoint/db migrate
pnpm test
pnpm dev                 # api :3001, web :3000, worker
```

Full stack in Docker (API + worker + web + Postgres + Redis):

```bash
docker compose up --build
```

- App: http://localhost:3000
- API health: http://localhost:3001/health
- Register **two** orgs in different browsers (or incognito) to see isolation
- Public status: http://localhost:3000/status/&lt;org-slug&gt;

### Prove the interesting bits

1. Register Acme as Alice (admin). Create a service + incident.
2. Register Globex as Bob. Bob’s incident list is empty; requesting Alice’s incident id returns **404**, not an empty body.
3. In Acme settings, invite two responders. Create a rotation of 3 people and a 2-step policy (rotation, then a specific user). GET the policy and confirm step order + targets.
4. Invite a **viewer**. They can read rotations/policies, but creating either returns **403**.
5. CI runs lint + tenancy/RBAC/policy tests on every PR.

## Demo GIF

_Placeholder — record after Phase 1 (escalation) when the loop is visible: trigger → page → ack in a second window → status page updates._

`docs/demo.gif`

## What I'd change with more time

- Row-level security in Postgres as defense in depth on top of the Prisma extension
- Real invite emails instead of admin-set passwords
- Compiled API (`tsc` → `dist`) instead of `tsx` in production images
- Multi-org users with an org switcher (JWT currently binds one membership)
- Hosted Auth.js/Clerk if we wanted social login without owning password hashing
- Cache-Control + CDN on the public status route (it’s already a separate layout/data path)
- Calendar-based on-call (coverage, overrides, timezones). Rotations are a manual ordered list + weekly round-robin pointer advanced by a BullMQ repeatable job.
- OpenAPI spec generated from the Nest controllers

## Repo map

```
apps/web          Next.js — (dashboard) vs /status/[orgSlug]
apps/api          NestJS — auth, RBAC, tenancy, services, rotations, policies, incidents
apps/worker       BullMQ: weekly rotation handoff (live) + escalation/notify stubs
packages/db       Prisma schema + tenantDb()
packages/shared-types   Roles, permissions, incident states, policy/rotation helpers
tests/unit        Policy data model + rotation pointer
tests/integration Tenancy isolation + RBAC boundary + rotation/policy CRUD
```
