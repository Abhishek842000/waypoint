# Waypoint progress

Hiring-manager resume notes live here so a new chat can pick up without rediscovering decisions.

## Current phase

**Phase 5 — Polish, testing, CI/CD** ✅ complete (local demo; no production hosting required)

**Phase 4 — Real-time updates + public status page** ✅ complete

**Phase 3 — Escalation worker durability** ✅ complete

**Phase 2 — Escalation timers, notifications, timeline** ✅ complete

**Phase 1 — Services, rotations, escalation policies** ✅ complete

**Phase 0 — Scaffolding, auth, multi-tenancy skeleton** ✅ complete

## What's built

### Phase 5
- Playwright e2e: register org → invite → service → rotation/policy → **API-key trigger** → wait for BullMQ `escalated` → ack → resolve → public status shows resolved/operational.
- CI: `typecheck` + Vitest on every PR; Playwright `e2e` job starts api/worker/web in the same step as the tests.
- Optional deploy workflow on `main` (Vercel/Railway) skips until tokens exist — **localhost is the demo**.
- API-key `POST /v1/incidents` rate limit (default 30/min/org, in-process fixed window). Session creates are not throttled. Still `@RequirePermission("incident:create")` + `tenantDb()`.
- README: architecture, ~10 minute clone path, BullMQ-vs-cron and tenancy rationale, honest more-time list. Demo video at `docs/demo.mp4` (GIF still at `docs/demo.gif`).

### Phase 4
- Org-scoped SSE; public status allow-list + ISR; service health from open incidents.

### Phase 3
- BullMQ delayed escalation in Redis; `ESCALATION_DELAY_MULTIPLIER`; no `setTimeout` in api/worker/jobs.

## What's tested

- Phase 0–4 tenancy/RBAC/escalation/SSE/public-status
- API-key create: 2 allowed then 429; read-only key still 403; session create not throttled
- Playwright core loop (CI + local against 3010/3011): **passed** (org → invite → service → policy → API-key trigger → BullMQ escalate → ack → resolve → public operational)

## Architectural decisions (defaults I picked)

| Decision | Pick | Tradeoff |
| --- | --- | --- |
| Hosting | Local `pnpm dev` (optional Vercel + Railway later) | Portfolio demo does not need a live URL |
| Rate limit store | In-process fixed window | Correct for one API replica; Redis INCR would be the multi-instance follow-up. |
| e2e clock | Real worker + multiplier `0.05` | Slow vs fake clock; proves the production path. |
| Demo GIF | Pillow-assembled frames from Playwright webm | Playwright's ffmpeg cannot mux GIF; settings frames with `wp_live_` keys were dropped. |

## Known simplifications / scope cuts

- **No calendar-based on-call.** Weekly round-robin pointer only (deliberate).
- Failed Slack/Twilio/Resend deliveries are recorded on the event; not auto-retried.
- Invites set a password directly (no email).
- Users belong to one org in the JWT.
- Host Postgres is on **5433**; this machine has used web/API **3010/3011**.
- Rate limiter is per-process memory (documented).
- Cloud deploy docs exist but are optional.

## How to resume

```bash
cd waypoint
docker compose up -d postgres redis
pnpm install
pnpm db:migrate:deploy
pnpm test
pnpm test:e2e
pnpm dev
```

Do not bypass `tenantDb()` or `@RequirePermission`. Do not implement escalation waits with `setTimeout`. Rate limiting must not skip RBAC.
