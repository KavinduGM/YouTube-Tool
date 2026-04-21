# Social Analytics

Internal analytics platform for monitoring YouTube channels and LinkedIn accounts across multiple clients. Compares growth across time periods, generates AI-powered monthly reports with Claude, and delivers scheduled PDF reports by email.

Phase 1 focus: analytics dashboard + automated reports.
Phase 2: social publishing tools.

## Stack

- **Framework**: Next.js 15 (App Router, React 19, TypeScript)
- **UI**: Tailwind CSS + shadcn/ui + Lucide icons
- **DB**: PostgreSQL 16 + Prisma ORM
- **Jobs / cache**: Redis 7 + BullMQ
- **Auth**: NextAuth v5 (credentials)
- **AI**: Anthropic Claude via `@anthropic-ai/sdk`
- **Charts**: Recharts
- **Email**: Resend
- **Deploy**: Docker + Dokploy on Ubuntu VPS

## Milestones

1. **Foundation** ← current (auth, DB, Docker, UI shell)
2. Client & channel management
3. YouTube OAuth + data sync
4. LinkedIn CSV import
5. Analytics dashboard
6. Multi-channel comparison + AI analysis
7. Automated monthly reports (PDF + email)
8. Polish + production deploy

---

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure (Postgres + Redis)

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Configure environment

```bash
cp .env.example .env
# Generate a real AUTH_SECRET:
openssl rand -base64 48
# Paste it into .env as AUTH_SECRET
```

### 4. Run migrations + seed admin

```bash
npm run db:migrate
npm run db:seed
```

Default admin (change in `.env` before seeding):
- Email: `admin@example.com`
- Password: `ChangeMe123!`

### 5. Start dev server

```bash
npm run dev
```

Open <http://localhost:3000> and sign in.

---

## Production deploy (Dokploy on Ubuntu VPS)

### One-time VPS setup

Install Dokploy on your Ubuntu server following the official Dokploy docs. Ensure Docker is running.

### Deploy this app

In Dokploy, create a new **Application** from this Git repository.

**Build settings:**
- Build type: `Dockerfile`
- Dockerfile path: `./Dockerfile`

**Environment variables** (set in the Dokploy UI):

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://<user>:<pw>@<postgres-service>:5432/social_analytics?schema=public` |
| `REDIS_URL` | `redis://<redis-service>:6379` |
| `AUTH_SECRET` | generated with `openssl rand -base64 48` |
| `AUTH_URL` | `https://analytics.yourdomain.com` |
| `ANTHROPIC_API_KEY` | your rotated Anthropic key |
| `RESEND_API_KEY` | (added in Milestone 7) |
| `RESEND_FROM` | (added in Milestone 7) |
| `GOOGLE_CLIENT_ID` | (added in Milestone 3) |
| `GOOGLE_CLIENT_SECRET` | (added in Milestone 3) |
| `YOUTUBE_REDIRECT_URI` | `https://analytics.yourdomain.com/api/youtube/oauth/callback` |

**Services to create in Dokploy:**

1. **Postgres 16** database service (Dokploy's built-in Postgres template)
2. **Redis 7** database service (Dokploy's built-in Redis template)
3. **Application** (this repo) — link to the two services above via `DATABASE_URL` and `REDIS_URL`

**Domain + SSL:** configure in Dokploy's Domains section. Enable Let's Encrypt.

**First deploy:**

The container entrypoint automatically runs `prisma migrate deploy` on startup. To seed the initial admin user after first deploy, open a shell into the app container:

```bash
docker exec -it <container-name> node -e "
  require('ts-node/register');
  require('./prisma/seed.ts');
"
```

Or temporarily set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` and run `npx tsx prisma/seed.ts` from a dev machine pointed at the production `DATABASE_URL`.

---

## Project structure

```
├── docker/                  # Docker entrypoint
├── prisma/
│   ├── schema.prisma        # DB schema (grows each milestone)
│   └── seed.ts              # Admin user seeding
├── src/
│   ├── app/
│   │   ├── (app)/           # Protected routes (sidebar layout)
│   │   │   ├── dashboard/
│   │   │   ├── clients/
│   │   │   ├── channels/
│   │   │   ├── compare/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── api/auth/        # NextAuth handler
│   │   ├── login/           # Public sign-in page
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── ui/              # shadcn/ui primitives
│   ├── lib/
│   │   ├── auth.ts          # NextAuth config
│   │   ├── prisma.ts        # Prisma singleton
│   │   ├── redis.ts         # Redis singleton
│   │   ├── env.ts           # env validation (zod)
│   │   └── utils.ts
│   └── middleware.ts        # Route protection
├── Dockerfile
├── docker-compose.yml       # Self-hosted full stack
├── docker-compose.dev.yml   # Local infra only
└── .env.example
```

---

## Security notes

- `.env` is gitignored. Never commit secrets.
- Rotate `AUTH_SECRET` if it ever leaks; all sessions invalidate.
- Rotate `ANTHROPIC_API_KEY` if it leaks; the compromised key the user initially shared has been flagged for rotation.
- Single-admin design by default. Additional users must be created manually via seed or Prisma Studio.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Create + apply a new migration (dev) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:push` | Push schema without migration (quick iteration) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed the admin user |
