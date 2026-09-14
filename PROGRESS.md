# Waypoint progress

Hiring-manager resume notes live here so a new chat can pick up without rediscovering decisions.

## Current phase

**Phase 0 — Scaffolding, auth, multi-tenancy skeleton** ✅ complete

Verified locally: `pnpm lint` + `pnpm test` (6/6), API + worker + web running. Registered Acme, created Payments API, triggered "Checkout 500s", acknowledged it, public `/status/acme-…` showed the incident with a separate unauthenticated layout.

## What's built

- pnpm workspaces monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/db`, `packages/shared-types`
- Docker Compose: Postgres, Redis, API, worker, web
- Full Prisma schema for the data model in the brief (plus denormalized `orgId` on child tables: `IncidentEvent`, `RotationMember`, `EscalationStep`)
- Session auth: register (creates User + Org + admin Membership), login, logout, `GET /v1/auth/me`
- API-key auth: `wp_live_…` via `Authorization: Bearer` or `X-Api-Key`, hashed at rest (SHA-256), scoped permissions
- Unified `Actor` (`authMethod`, `userId`, `orgId`, `role`, `scopes`) so downstream code does not care how you authenticated
- `tenantDb()` Prisma extension + `AsyncLocalStorage`. Tenant models cannot use `findUnique`. Creates **overwrite** `orgId`. Missing context throws.
- `@RequirePermission('incident:acknowledge')` guard on mutating *and* read API routes
- Services CRUD, incidents create/ack/resolve + immutable `IncidentEvent` timeline
- Public `GET /v1/public/status/:orgSlug` still runs through `runWithTenant` after slug → orgId
- Next.js dashboard (incidents, services, member invite) and a **separate** public status route with its own layout
- Worker process connected to Redis; `escalate-incident` and `deliver-notification` processors are stubs
- GitHub Actions: lint + integration tests against Postgres

## What's tested

- **Tenancy:** org B `GET /v1/incidents/:id` for org A's incident → **404** (not empty list). Cross-tenant ack → 404. Stuffing `orgId` in a create body cannot write into another tenant.
- **RBAC:** viewer can read, cannot create services / ack / resolve / invite (403 with permission name). Responder can ack, cannot invite. API key with `incident:create` can open an incident and cannot ack.

## Architectural decisions (defaults I picked)

| Decision | Pick | Tradeoff |
| --- | --- | --- |
| API framework | NestJS | More ceremony than Express; guards/modules are the interview story |
| ORM | Prisma | Extension API is ideal for forced scoping; Drizzle would be more SQL-shaped |
| Auth | Nest JWT httpOnly cookie, not Auth.js/Clerk | Keeps actor resolution on the API. No social login yet |
| Realtime | SSE planned (stub hook only) | SSE is enough for one-way incident timelines; WS if we add presence later |
| Monorepo | pnpm workspaces, no Turbo | Less config; add Turbo if CI build graph becomes slow |
| API runtime | `tsx` | Faster Phase 0. Compile before production hardening |
| Public status | Next.js route + public API | Status page has no dashboard layout/session. Cache headers not applied yet |

## Known simplifications / scope cuts (Phase 0)

- Escalation policies, rotations, and BullMQ *logic* are not implemented — only the worker process, job names, and schema
- No WebSocket/SSE push (hook is a stub; do **not** poll as a substitute)
- Invites set a password directly (no email)
- Users belong to one org in the JWT (first membership on login)
- Service status is not auto-updated when an incident is triggered
- No outbound Slack/email yet
- Demo GIF placeholder in README
- Playwright e2e not started
- Nest constructors use explicit `@Inject()` so the API can run under `tsx` (esbuild does not emit decorator metadata). Tests still use SWC with metadata.
- Host Postgres is published on **5433** (this machine already had 5432). Web/API default to 3000/3001; if those are taken, `API_PORT` + `NEXT_PUBLIC_API_URL` + `WEB_ORIGIN`.

## Next phase

**Phase 1 — On-call rotations & escalation via BullMQ**

- Rotation CRUD + current pointer
- Escalation policy steps
- On incident create: enqueue `escalate-incident` delayed jobs (not `setTimeout`)
- Ack/resolve cancels pending jobs
- Integration test: freeze/advance fake time or use short waitMinutes against Redis

## How to resume

```bash
cd waypoint
cp .env.example .env   # if needed
docker compose up -d postgres redis
pnpm install
pnpm db:migrate:deploy
pnpm test
pnpm dev
```

Read this file + `README.md` + `packages/db/src/tenancy.ts` + `apps/api/src/modules/rbac/` before writing feature code. Do not bypass `tenantDb()` or `@RequirePermission`.
