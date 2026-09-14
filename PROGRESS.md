# Waypoint progress

Hiring-manager resume notes live here so a new chat can pick up without rediscovering decisions.

## Current phase

**Phase 3 — Escalation worker durability** ✅ complete

**Phase 2 — Escalation timers, notifications, timeline** ✅ complete

**Phase 1 — Services, rotations, escalation policies** ✅ complete

**Phase 0 — Scaffolding, auth, multi-tenancy skeleton** ✅ complete

## What's built

### Phase 3
- Production scheduling is **BullMQ delayed jobs in Redis** (`WAYPOINT_JOBS=bullmq`). Fast unit/API tests still use the in-memory fake clock (`WAYPOINT_JOBS=memory`) that calls the **same** `applyEscalationStep`.
- `ESCALATION_DELAY_MULTIPLIER` scales `waitMinutes` at enqueue time (default `1`). `10/300` turns a 5-minute step into 10 seconds. API and worker must share the value.
- Handler still: if status is not `triggered` → no-op; else bump `currentEscalationStep`, notify, write `escalated`, enqueue the next delay.
- Ack/resolve **remove** delayed jobs from Redis. A killed worker does **not** remove them — restart picks them up.
- Incident detail polls the timeline every 2s while still triggered (UI only; the clock is still Redis).

### Phase 2
- Guarded `acknowledge` / `resolve`; `GET /v1/incidents/:id/timeline` is the IncidentEvent log
- Slack incoming webhook (Twilio/Resend same dispatcher)
- `@waypoint/jobs` shared by API + worker

### Phase 1
- Services, rotations (BullMQ weekly pointer), escalation policy CRUD

### Phase 0 (still true)
- pnpm workspaces, Compose, Prisma tenancy extension, JWT + API keys, unified Actor, RBAC guard, public status page, CI

## What's tested

- **Unit:** illegal transitions; `waitMinutesToDelayMs(5)` with multiplier `10/300` = 10s; **no `setTimeout(`** in `packages/jobs`, `apps/worker`, or `apps/api`
- **Fake clock (fast):** 1-minute step, `elapse(59000)` no escalate, `elapse(1000)` writes `escalated`; ack cancels
- **Real Redis (db 15, spawned worker process):**
  - 3-step policy: unacked incident emits `triggered` + two `escalated` events on schedule
  - SIGTERM the worker with a delayed job in Redis, restart it, escalation still fires
  - Ack removes the delayed job; waiting past the window does not escalate
- Phase 0–2 tenancy/RBAC tests still required green

## Architectural decisions (defaults I picked)

| Decision | Pick | Tradeoff |
| --- | --- | --- |
| Durability test isolation | Redis **database 15** + a spawned `tsx` worker | Does not collide with a demo worker on db 0 |
| Short windows | `ESCALATION_DELAY_MULTIPLIER` on delay ms | Policy rows still store real minutes; demo/CI shrinks them |
| Fast vs durable tests | `WAYPOINT_JOBS=memory` (default in vitest) vs `bullmq` | Fake clock is not the production clock; the restart spec is |

## Known simplifications / scope cuts

- **No calendar-based on-call.** Weekly round-robin pointer only (deliberate).
- Failed Slack/Twilio/Resend deliveries are recorded on the event; not auto-retried via `deliver-notification` yet.
- SMS destination is the channel's `config.to` (users have no phone).
- No WebSocket/SSE — triggered incidents poll the timeline every 2s in the browser.
- Invites set a password directly (no email)
- Users belong to one org in the JWT
- Service status is not auto-updated when an incident is triggered
- Host Postgres is on **5433**; web/API default 3000/3001 (this machine used 3010/3011)

## Next phase

Whatever the original brief lists after the worker (likely public status history / SSE). Confirm before starting.

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

Do not bypass `tenantDb()` or `@RequirePermission`. Do not implement escalation waits with `setTimeout`. Paging/notify belong in `@waypoint/jobs`.
