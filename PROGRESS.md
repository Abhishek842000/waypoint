# Waypoint progress

Hiring-manager resume notes live here so a new chat can pick up without rediscovering decisions.

## Current phase

**Phase 2 — Escalation timers, notifications, timeline** ✅ complete

**Phase 1 — Services, rotations, escalation policies** ✅ complete

**Phase 0 — Scaffolding, auth, multi-tenancy skeleton** ✅ complete

## What's built

### Phase 2
- Incident transitions are **guarded methods** (`acknowledge` / `resolve` → one private `transition()`). Status is not a free-form PATCH. Legal edges live in `packages/shared-types` (`triggered → acknowledged → resolved`, plus skip-ack resolve).
- Every transition (and each escalation) writes an `IncidentEvent`. `GET /v1/incidents/:id/timeline` returns that ordered log — UI and audit are the same data (`timeline()` reuses `get()`).
- On create: `onIncidentOpened` (shared with the worker) pages step 0, records the triggered event with delivery results, and enqueues the next step on **BullMQ** using `waitMinutes` (never `setTimeout`).
- Ack/resolve **cancels** pending escalate jobs. The worker also no-ops if status is no longer `triggered`.
- Notifications: one dispatcher (`notifyIncident`) fans out to org channels. **Slack incoming webhook** is the proven path; **Twilio SMS** and **Resend email** share the same adapter interface and skip cleanly when env creds are missing.
- Admin Settings: Slack/SMS/email channels + API key minting for curl monitors.
- Dashboard: incident detail timeline, policy picker on create, ack hidden for viewers.

### Phase 1
- Service CRUD: admin create/update/delete, all org roles can read; dashboard can patch status
- Rotation CRUD: ordered `memberUserIds`, `currentlyOnCall` derived from `currentPointer`
- Weekly handoff is a **BullMQ repeatable job** (`advance-rotations`, every 60s tick)
- Escalation policy CRUD: ordered steps, `waitMinutes`, last step marked `isTerminal`
- Dashboard pages: `/rotations`, `/policies`

### Phase 0 (still true)
- pnpm workspaces, Compose, Prisma tenancy extension, JWT + API keys, unified Actor, RBAC guard, public status page, CI

## What's tested

- **Unit:** legal vs illegal incident transitions (resolved cannot be re-acked); policy/rotation helpers from Phase 1
- **State machine:** resolve then acknowledge → **409**
- **RBAC:** viewer GET timeline 200, POST acknowledge **403**; viewer cannot create a notification channel
- **Tenancy:** org B GET of org A's timeline → **404**
- **Escalation:** 2-step policy, `waitMinutes: 1`; fake clock `elapse(59000)` no escalate, `elapse(1000)` writes `escalated` and pages step 1; ack cancels the pending job
- **Slack:** trigger via session or API key POSTs the incoming webhook (capturing transport in tests); payload is on the timeline event
- Phase 0/1 tenancy/RBAC/rotation tests still required green

## Architectural decisions (defaults I picked)

| Decision | Pick | Tradeoff |
| --- | --- | --- |
| Shared paging/notify | `@waypoint/jobs` used by API + worker | Extra package; avoids Nest in the worker and duplicated notify logic |
| Escalation delay | BullMQ delayed job per next step; `jobId = escalate:{incidentId}:{step}` | Tests use an in-memory fake clock (`NODE_ENV=test`) that calls the **same** `applyEscalationStep` |
| First page | Step 0 on trigger, then wait `waitMinutes` of that step before step 1 | Matches "page, wait, page" — not "wait then page step 0" |
| Notify on trigger | Inline `notifyIncident` (same function the worker uses on escalate) | Slack fires even if the worker is down; delays still require BullMQ |
| Slack first | Incoming webhook per org | Twilio/Resend skipped without env; no user phone numbers on User |

## Known simplifications / scope cuts

- **No calendar-based on-call.** Weekly round-robin pointer only (deliberate).
- Failed Slack/Twilio/Resend deliveries are recorded on the event; they are not automatically retried via the `deliver-notification` queue yet (processor exists and calls the same `notifyIncident`).
- SMS destination is the channel's `config.to`, not a user phone field (users have no phone).
- Email uses Resend; `config.to` or the paged user's email.
- No WebSocket/SSE push — refresh the timeline.
- Invites set a password directly (no email)
- Users belong to one org in the JWT
- Service status is not auto-updated when an incident is triggered
- Host Postgres is on **5433**; web/API default 3000/3001 (this machine used 3010/3011)

## Next phase

**Phase 3** (not started) — likely public status history, SSE/live updates, or hardening retries. Confirm against the original brief before starting.

## How to resume

```bash
cd waypoint
docker compose up -d postgres redis
pnpm install
pnpm db:migrate:deploy
pnpm test
pnpm dev
```

Do not bypass `tenantDb()` or `@RequirePermission`. Do not implement escalation waits with `setTimeout`. Paging/notify belong in `@waypoint/jobs`, not copied into the controller.
