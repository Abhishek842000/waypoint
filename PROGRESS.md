# Waypoint progress

Hiring-manager resume notes live here so a new chat can pick up without rediscovering decisions.

## Current phase

**Phase 1 — Services, rotations, escalation policies** ✅ complete

**Phase 0 — Scaffolding, auth, multi-tenancy skeleton** ✅ complete

## What's built

### Phase 1
- Service CRUD unchanged: admin create/update/delete, all org roles can read; dashboard can patch status
- Rotation CRUD: ordered `memberUserIds`, `currentlyOnCall` derived from `currentPointer`
- Weekly handoff is a **BullMQ repeatable job** (`advance-rotations`, every 60s tick; advances when `handoffIntervalDays` elapsed). Not `setTimeout`.
- Escalation policy CRUD: ordered steps targeting a rotation or a specific org user, `waitMinutes`, last step marked `isTerminal`
- Dashboard pages: `/rotations`, `/policies`

### Phase 0 (still true)
- pnpm workspaces, Compose, Prisma tenancy extension, JWT + API keys, unified Actor, RBAC guard, incidents state machine, public status page, CI

## What's tested

- **Unit:** single-step (terminal) policy; user vs rotation target resolution; last-step-has-no-next; invalid mixed targets; pointer wrap + weekly due check
- **Acceptance:** create 3-member rotation + 2-step policy; stored stepOrder and targets match
- **Tenancy:** org B GET of org A's rotation/policy → 404; lists stay empty
- **RBAC:** viewer can GET rotations, cannot POST rotation or policy (403)
- **Handoff:** backdate `lastHandoffAt`, run `advanceDueRotations(now)`, pointer moves to the next member
- Phase 0 tenancy/RBAC incident tests still required green

## Architectural decisions (defaults I picked)

| Decision | Pick | Tradeoff |
| --- | --- | --- |
| On-call scheduling | Ordered roster + integer pointer, default 7-day interval | Not calendar coverage, overrides, or timezones |
| Handoff timer | One repeatable BullMQ job scans due rotations | Simpler than one delayed job per rotation; 60s tick is demo-friendly |
| Policy helpers | Pure functions in `packages/shared-types` | API hydrates `resolvedTarget`; worker will reuse this in Phase 2 |

## Known simplifications / scope cuts

- **No calendar-based on-call.** Weekly round-robin pointer only (deliberate).
- Incident auto-escalation (page step 0, wait, page step 1) is **not** wired yet — waitMinutes is stored. Phase 2 will enqueue delayed BullMQ jobs on incident create and cancel them on ack/resolve.
- Escalate-incident / deliver-notification processors remain stubs
- No WebSocket/SSE push
- Invites set a password directly (no email)
- Users belong to one org in the JWT
- Service status is not auto-updated when an incident is triggered
- Host Postgres is on **5433**; web/API default 3000/3001 (this machine used 3010/3011)

## Next phase

**Phase 2 — Escalation timers on incidents**

- On incident create: enqueue delayed `escalate-incident` jobs from policy steps (BullMQ, not setTimeout)
- Ack/resolve cancels pending jobs
- Notify the resolved target (rotation current on-call or fixed user)
- Integration test with short waitMinutes / fake clock

## How to resume

```bash
cd waypoint
docker compose up -d postgres redis
pnpm install
pnpm db:migrate:deploy
pnpm test
pnpm dev
```

Do not bypass `tenantDb()` or `@RequirePermission`. Do not implement escalation waits with `setTimeout`.
