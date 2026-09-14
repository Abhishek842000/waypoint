# Deploy Waypoint

Web → **Vercel**. API + worker + Postgres + Redis → **Railway**.
That split keeps the public status page on a CDN while the worker can still
see Redis delayed jobs after a restart.

A merge to `main` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).
Jobs skip with a log line until the GitHub secrets below exist. First-time
setup is dashboard + secrets — this repo cannot create cloud accounts for you.

## 1. Railway (API, worker, Postgres, Redis)

1. [railway.app](https://railway.app) → New Project → **Deploy from GitHub** (`Abhishek842000/waypoint`).
2. Add plugins: **PostgreSQL** and **Redis**.
3. Create two services from the same repo + root `Dockerfile`:

| Service | Start command | Notes |
| --- | --- | --- |
| `waypoint-api` | `pnpm --filter @waypoint/db migrate:deploy && pnpm --filter @waypoint/api start` | Generate a public HTTPS domain. In the service settings, health check **GET `/health`**. Railway injects `PORT`. |
| `waypoint-worker` | `pnpm --filter @waypoint/worker start` | No HTTP port. Do **not** attach the `/health` check here. |

4. Variables (set on **both** api and worker unless noted):

| Variable | Where | Example |
| --- | --- | --- |
| `DATABASE_URL` | api + worker | Railway Postgres `DATABASE_URL` (add `?schema=public` if missing) |
| `REDIS_URL` | api + worker | Railway Redis URL |
| `JWT_SECRET` | api | long random string |
| `WEB_ORIGIN` | api | `https://<your-vercel-app>.vercel.app` (comma-separate preview origins) |
| `STATUS_REVALIDATE_SECRET` | api + web | shared random string |
| `ESCALATION_DELAY_MULTIPLIER` | api + worker | `1` in prod; `0.05` only for a timed demo |
| `INCIDENT_CREATE_RATE_LIMIT` | api | `30` (per org / minute, API-key creates only) |
| `INCIDENT_CREATE_RATE_WINDOW_MS` | api | `60000` |
| `WORKER_CONCURRENCY` | worker | `5` |
| `TWILIO_*` / `RESEND_*` | api + worker | optional notify |

`PORT` is set by Railway. `apps/api/src/main.ts` reads `PORT` then `API_PORT`.

Copy the project id from Railway (Settings → General) into GitHub secret `RAILWAY_PROJECT_ID`.

## 2. Vercel (Next.js dashboard + `/status/[orgSlug]`)

1. Import the GitHub repo in Vercel.
2. Framework Preset: **Next.js**.
3. **Root Directory: `apps/web`**. Include files outside the root (pnpm workspace) stays on.
4. Environment variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://<waypoint-api>.up.railway.app` |
| `STATUS_REVALIDATE_SECRET` | same as Railway |
| `API_URL` | same as `NEXT_PUBLIC_API_URL` if you want server fetches explicit |

`apps/web/vercel.json` runs `pnpm install` and `pnpm --filter @waypoint/web build` from the repo root.

5. Deploy. Copy the `*.vercel.app` URL into Railway `WEB_ORIGIN`.
6. Production cookies are `SameSite=None; Secure` so the dashboard can call a
   different API host with credentials (SSE included).

## 3. GitHub Actions secrets (deploy on merge to main)

| Secret | From |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | same |
| `RAILWAY_TOKEN` | Railway → Account → Tokens |
| `RAILWAY_PROJECT_ID` | Railway project Settings → General |

Until `VERCEL_TOKEN` / `RAILWAY_TOKEN` are set, the Deploy workflow checks out
nothing and prints that it skipped. That is expected.

## 4. Smoke the live demo

```bash
curl -sf https://<waypoint-api>.up.railway.app/health
# Register from the Vercel URL, create a service, trigger an incident with an API key,
# open https://<vercel>/status/<org-slug> logged out.
```

Then paste the URLs into the README **Live demo** table.
