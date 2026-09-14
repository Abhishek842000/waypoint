# Waypoint progress

Hiring-manager resume notes live here so a new chat can pick up without rediscovering decisions.

## Current phase

**Phase 4 — Real-time updates + public status page** ✅ complete

**Phase 3 — Escalation worker durability** ✅ complete

**Phase 2 — Escalation timers, notifications, timeline** ✅ complete

**Phase 1 — Services, rotations, escalation policies** ✅ complete

**Phase 0 — Scaffolding, auth, multi-tenancy skeleton** ✅ complete

## What's built

### Phase 4
- Authenticated **SSE** at `GET /v1/realtime/incidents` (`incident:read`). The stream is bound to `actor.orgId`; query `orgId` is ignored.
- Publish path is `recordIncidentEvent` → in-process bus + Redis `waypoint:org-realtime` so the **worker** can fan in escalations. Same-process origin is skipped to avoid duplicates.
- Dashboard incident detail (and list) subscribe with `EventSource(..., { withCredentials: true })` and refetch. **No 2s polling.**
- Public `/status/[orgSlug]` is outside `(dashboard)`: no auth, 10s ISR tags + `POST /api/revalidate` (secret header) from incident writes. API payload is `toPublicStatusPayload` allow-list only.
- Open incidents drive `Service.currentStatus` (critical → major_outage, etc.). Resolve restores operational when nothing else is open.

### Phase 3
- Production scheduling is **BullMQ delayed jobs in Redis** (`WAYPOINT_JOBS=bullmq`). Fast unit/API tests still use the in-memory fake clock (`WAYPOINT_JOBS=memory`) that calls the **same** `applyEscalationStep`.
- `ESCALATION_DELAY_MULTIPLIER` scales `waitMinutes` at enqueue time (default `1`).
- Ack/resolve **remove** delayed jobs from Redis. A killed worker does **not** remove them — restart picks them up.

### Phase 2
- Guarded `acknowledge` / `resolve`; `GET /v1/incidents/:id/timeline` is the IncidentEvent log
- Slack incoming webhook (Twilio/Resend same dispatcher)
- `@waypoint/jobs` shared by API + worker

### Phase 1
- Services, rotations (BullMQ weekly pointer), escalation policy CRUD

### Phase 0 (still true)
- pnpm workspaces, Compose, Prisma tenancy extension, JWT + API keys, unified Actor, RBAC guard, CI

## What's tested

- **Unit:** illegal transitions; delay multiplier; **no `setTimeout(`** in jobs/worker/api; public payload drops emails/actor ids; severity → service status
- **SSE:** unauthenticated 401; Riley’s stream sees Alice’s ack; Globex stream stays empty even with `?orgId=<acme>`
- **Public status:** no cookie required; Acme slug never includes Globex services/incidents; JSON keys are the allow-list; no member names/emails
- Phase 0–3 tenancy/RBAC/escalation tests still required green

## Architectural decisions (defaults I picked)

| Decision | Pick | Tradeoff |
| --- | --- | --- |
| Live dashboard | **SSE** over WebSocket | Cookie auth + Nest `@Sse()`; no socket.io. One-way is enough (clients still POST ack/resolve). |
| Cross-process fan-in | Redis pub/sub + in-process EventEmitter | Needed because the worker is a separate process. Tests keep `WAYPOINT_JOBS=memory` (in-process only). |
| Public freshness | 10s ISR + on-demand `revalidatePath`/`revalidateTag` | CDN-friendly; not instant unless Next receives the webhook. Public page also `router.refresh()` every 10s. |
| Public fields | Explicit mapper in `shared-types` | Safer than stripping after `findMany` of full rows. |

## Known simplifications / scope cuts

- **No calendar-based on-call.** Weekly round-robin pointer only (deliberate).
- Failed Slack/Twilio/Resend deliveries are recorded on the event; not auto-retried via `deliver-notification` yet.
- SMS destination is the channel's `config.to` (users have no phone).
- Invites set a password directly (no email)
- Users belong to one org in the JWT
- Realtime Redis is fire-and-forget if Redis is down; the authenticated timeline GET is still source of truth
- Host Postgres is on **5433**; web/API default 3000/3001 (this machine has used 3010/3011)

## Next phase

Whatever the original brief lists after public status (if any). Confirm before starting.

## How to resume

```bash
cd waypoint
docker compose up -d postgres redis
pnpm install
pnpm db:migrate:deploy
pnpm test
# Demo a 3s-per-minute window:
ESCALATION_DELAY_MULTIPLIER=0.05 pnpm dev
```

Do not bypass `tenantDb()` or `@RequirePermission`. Do not implement escalation waits with `setTimeout`. Paging/notify belong in `@waypoint/jobs`. SSE org scope is always `actor.orgId`.
