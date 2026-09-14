# Playwright e2e

Core loop: create org → invite member → service → rotation/policy → trigger via API key → wait for BullMQ escalate → ack → resolve → public status shows resolved.

```bash
# Postgres + Redis + api/web/worker already running (or let Playwright start `pnpm dev`)
pnpm exec playwright install chromium
pnpm test:e2e
```

Against this machine's demo ports:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3010 NEXT_PUBLIC_API_URL=http://localhost:3011 pnpm test:e2e
```

Escalation uses `ESCALATION_DELAY_MULTIPLIER` (CI sets `0.05` so a 1-minute step is ~3s). The worker process must be up — the clock is Redis, not `setTimeout`.

Register emails must use a real TLD (`@acme.test` works; `@acme.e2e` fails Zod).
