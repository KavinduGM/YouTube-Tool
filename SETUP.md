# Setup & Deployment Guide

This guide walks you through everything you need to stand up the Social
Analytics tool on your own infrastructure (local dev → Ubuntu VPS via Dokploy).

The app has three runtime pieces:

1. **Next.js web app** (UI + API routes + server actions)
2. **BullMQ worker** (scheduled syncs + monthly report dispatch)
3. **Postgres + Redis** (data + job queue)

You do **not** write any code — every secret is passed as an environment
variable. The only "code change" you might make is editing `.env` values.

---

## 0. What you need before you start

| Item | Why | Where to get it |
| --- | --- | --- |
| A domain name | YouTube OAuth redirect + email sender | Any registrar |
| Google Cloud project | YouTube Data + Analytics APIs | https://console.cloud.google.com |
| Anthropic API key | AI insights + narrative in reports | https://console.anthropic.com |
| Resend account | Delivers monthly PDFs by email | https://resend.com |
| Ubuntu 22.04+ VPS | Host everything | Any provider (Hetzner, DO, Linode) |
| Dokploy installed on VPS | One-click deploys | https://dokploy.com/docs |

---

## 1. Google Cloud — enable YouTube APIs & create OAuth client

1. Go to https://console.cloud.google.com and create a new project (name it
   anything, e.g. `social-analytics`).
2. **Enable APIs** → search and enable each:
   - YouTube Data API v3
   - YouTube Analytics API
   - YouTube Reporting API
3. **OAuth consent screen**
   - User type: **External**
   - App name: anything (e.g. `Social Analytics`)
   - User support email + developer email: yours
   - Scopes — add:
     - `.../auth/youtube.readonly`
     - `.../auth/yt-analytics.readonly`
     - `.../auth/yt-analytics-monetary.readonly`
   - Test users: add your own Google account and any account that owns the
     channels you'll connect.
   - Leave in **Testing** mode (fine for an internal tool up to 100 test users).
4. **Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs — add **both**:
     - `http://localhost:3000/api/youtube/oauth/callback` (for local dev)
     - `https://YOUR_DOMAIN/api/youtube/oauth/callback` (for production)
   - Copy the **Client ID** and **Client secret** — you'll paste them into
     `.env` in step 5.

> Refreshing tokens will fail silently for *non-test* Google accounts while
> the consent screen is in Testing. If you add new channels later, ensure
> their owning account is also listed under Test users.

---

## 2. Anthropic API key

1. Go to https://console.anthropic.com → **API Keys** → **Create Key**.
2. Name it (e.g. `social-analytics-prod`), copy the value.
3. Set a reasonable **monthly spend cap** in Anthropic's usage settings — the
   app only calls Claude when you click "Generate insights" or when a monthly
   report builds. Expected cost per report: $0.01–$0.05.

---

## 3. Resend — email sender

1. Sign up at https://resend.com.
2. **Domains → Add Domain** → enter your domain (e.g. `yourdomain.com`).
3. Add the DNS records Resend gives you (SPF, DKIM, DMARC) at your
   registrar. Wait until Resend shows **Verified** (usually < 10 min).
4. **API Keys → Create API Key** with "Sending access" scope. Copy the key.
5. Decide your `From` address, e.g. `Social Analytics <reports@yourdomain.com>`.

---

## 4. Clone the repo on your VPS

```bash
ssh user@your-vps
sudo apt update && sudo apt install -y git
git clone https://github.com/KavinduGM/YouTube-Tool.git
cd YouTube-Tool
```

(If you prefer Dokploy's Git integration, skip this — Dokploy will clone it
for you when you create the project, see step 7.)

---

## 5. Create your `.env`

The repo ships with `.env.example`. Copy it and fill it in — this is the only
file you ever edit manually.

```bash
cp .env.example .env
nano .env
```

Paste in the values you collected in steps 1–3. A complete production `.env`
looks like:

```dotenv
NODE_ENV=production

# Postgres + Redis (use the in-compose services in step 6)
DATABASE_URL=postgresql://postgres:STRONG_PG_PASSWORD@postgres:5432/social_analytics?schema=public
REDIS_URL=redis://redis:6379

# NextAuth
AUTH_SECRET=PASTE_64_CHAR_RANDOM_STRING_HERE
AUTH_URL=https://YOUR_DOMAIN

# Admin seed — used once by prisma/seed.ts to create the first admin
SEED_ADMIN_EMAIL=you@yourdomain.com
SEED_ADMIN_PASSWORD=a-strong-password
SEED_ADMIN_NAME=Kavindu

# Anthropic (step 2)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Resend (step 3)
RESEND_API_KEY=re_...
RESEND_FROM="Social Analytics <reports@yourdomain.com>"

# Google OAuth (step 1)
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
YOUTUBE_REDIRECT_URI=https://YOUR_DOMAIN/api/youtube/oauth/callback

# Postgres superuser (used by the `postgres` service in docker-compose.yml)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=STRONG_PG_PASSWORD
POSTGRES_DB=social_analytics
POSTGRES_PORT=5432
REDIS_PORT=6379
APP_PORT=3000
```

Generate a strong `AUTH_SECRET` with:

```bash
openssl rand -base64 48
```

> Make sure `DATABASE_URL` and `POSTGRES_PASSWORD` use the **same** password
> and that `DATABASE_URL`'s host is `postgres` (the docker-compose service
> name), not `localhost`.

---

## 6. Start everything with Docker Compose

The repo ships with a 4-service `docker-compose.yml`:

| Service | What it does |
| --- | --- |
| `postgres` | Persistent database |
| `redis` | BullMQ job queue |
| `app` | Next.js web UI on port 3000 |
| `worker` | Runs scheduled syncs + monthly reports |

Build and launch:

```bash
docker compose up -d --build
```

First boot: the `app` container runs `prisma migrate deploy` automatically via
`docker/entrypoint.sh`, creating every table.

### Create the first admin user

```bash
docker compose exec app node node_modules/prisma/build/index.js db seed
```

This reads `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `.env` and
creates the admin account.

### Verify

```bash
docker compose ps                 # all four services should be "Up"
docker compose logs -f app        # should end with "Ready in ..."
docker compose logs -f worker     # should end with worker: ready
```

The app is now serving on `http://YOUR_VPS_IP:3000`. Next, put it behind a
domain + TLS — see step 7.

---

## 7. Deploy via Dokploy (recommended for VPS)

If you're using Dokploy instead of raw docker-compose:

1. **Dokploy → New Project → Docker Compose**.
2. **Source**: Git → paste `https://github.com/KavinduGM/YouTube-Tool.git`,
   branch `main`.
3. **Compose file path**: `docker-compose.yml`.
4. **Environment**: paste the entire contents of your `.env` into the
   Environment Variables panel.
5. **Domain**: Dokploy → Domains → Add → point `YOUR_DOMAIN` at the `app`
   service on port `3000`. Enable **Let's Encrypt** for HTTPS.
6. **Deploy**. Dokploy will `docker compose up --build` and proxy TLS.

Then seed the admin from the Dokploy **Terminal** button on the `app` service:

```bash
node node_modules/prisma/build/index.js db seed
```

---

## 8. First login & connect a channel

1. Visit `https://YOUR_DOMAIN/login`, log in with the seed admin.
2. **Settings** → verify every integration shows **Configured** (green badge):
   - Google OAuth ✅
   - Anthropic ✅
   - Resend ✅
   - Redis ✅
3. **Settings → Monthly report schedule**:
   - **Day of month**: the day reports fire (1–28, default `1`).
   - **Timezone**: IANA (e.g. `America/New_York`).
   - **Recipients**: comma-separated emails who receive every client's PDF.
   - **Daily sync hour (UTC)**: the hour YouTube analytics are pulled (default `3`).
4. **Clients → Add client** — create your first client profile.
5. From that client's page, click **Connect YouTube**, pick the Google
   account that owns the channel(s), and select one or more channels on the
   picker page.
6. Open the connected channel — it'll show "No data yet". Either:
   - Wait until tomorrow's 03:00 UTC auto-sync, **or**
   - Click **Sync now** to pull immediately.

---

## 9. Test the end-to-end flow

Once you have at least one synced channel:

1. **Channel dashboard** → change time ranges, check charts.
2. **Insights card → Generate** — Claude produces a markdown analysis. Verify
   it matches the data.
3. **Compare page** — select multiple channels, switch metrics.
4. **Reports page → Generate & email** on your client row — a PDF lands in
   the recipient inboxes within ~30 seconds. Verify the attachment opens
   cleanly and the numbers match the dashboard.
5. Wait for the next scheduled run (or temporarily set day-of-month to today
   and hour 3 to "current UTC hour + 1" via Settings → save → watch worker
   logs) to confirm the BullMQ schedule fires.

---

## 10. Updating the deployed app

Every code change you want to push lives in this repo. On the VPS:

```bash
cd YouTube-Tool
git pull origin main
docker compose up -d --build
```

Dokploy: click **Redeploy** — it does the same three commands.

Schema changes run themselves on container start thanks to `entrypoint.sh`
(`prisma migrate deploy`). You never run migrations by hand in production.

---

## 11. What lives where

| Feature | File |
| --- | --- |
| OAuth start/callback | `src/app/api/youtube/oauth/*` |
| Channel picker UI | `src/app/(app)/clients/[slug]/connect/[pendingId]/*` |
| Channel sync logic | `src/lib/youtube/sync.ts` |
| Analytics aggregations | `src/lib/analytics/queries.ts` |
| Charts | `src/components/charts/*` |
| AI insights (dashboard) | `src/lib/ai/analyze.ts` |
| PDF report renderer | `src/lib/reports/pdf.tsx` |
| Report data builder | `src/lib/reports/monthly-data.ts` |
| Report email action | `src/lib/actions/reports.ts` |
| Email sender (Resend) | `src/lib/email/resend.ts` |
| BullMQ queues | `src/lib/queue/queues.ts` |
| Scheduler (cron reconcile) | `src/lib/queue/scheduler.ts` |
| Worker entrypoint | `src/worker/index.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Admin seed | `prisma/seed.ts` |

---

## 12. Troubleshooting

**OAuth callback `redirect_uri_mismatch`**
Your Google OAuth client's redirect URIs don't include the exact URL you're
running. In Google Cloud → Credentials → OAuth client, add both the local
and production URIs verbatim (including trailing path, no trailing slash).

**Reports page says "No recipients configured"**
Settings → Monthly report schedule → Recipients: add at least one address
with an `@` and save.

**Emails not delivered, Resend shows the request**
Your domain's DKIM/SPF isn't verified. Check Resend → Domains and re-add the
DNS records your registrar rejected.

**Worker starts then exits**
Almost always `REDIS_URL` wrong or `AUTH_SECRET` missing. `docker compose
logs worker` will show the exact error.

**`prisma migrate deploy` fails on first boot**
The database isn't reachable. Make sure `DATABASE_URL`'s host is `postgres`
(not `localhost`) when running inside compose.

**Claude insights button is disabled**
`ANTHROPIC_API_KEY` is missing or wrong. Settings → Integrations will show
"Not configured" in that case.

**Monthly report PDF has blank charts**
The channel has fewer than 2 months of data. Wait until at least two daily
syncs have completed across two calendar months.

---

## 13. Cost expectations (1 admin, ~20 channels)

| Service | Monthly |
| --- | --- |
| VPS (Hetzner CX22) | ~€5 |
| Postgres + Redis | included (self-hosted) |
| Resend (100 emails/day free tier) | $0 |
| Anthropic | $5–20 depending on how often you generate insights |
| Google APIs | $0 (free quota easily covers 20 channels) |

Everything you pay for, you control via the `.env` caps in the respective
provider dashboards.
