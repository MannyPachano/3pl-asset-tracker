# 3PL Asset Tracker (MVP)

B2B web app for small–mid 3PL companies to track physical logistics assets. Built with Next.js (App Router), Postgres, and Prisma.

## Phase 1.1 — Setup

- **Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL.
- **Database:** Schema and migrations live in `prisma/`. Tables match `DATABASE-SCHEMA.md` exactly (Organization, User, AssetType, Client, Warehouse, Zone, Asset, AssetHistory).

### Run locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Database**

   - Create a PostgreSQL database (e.g. `3pl_asset_tracker`).
   - Add a `.env` file in the project root:

     ```env
     DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
     ```

   - Run migrations: see **[MIGRATIONS.md](./MIGRATIONS.md)** for exact steps (`npx prisma generate`, `npx prisma migrate deploy`).
   - Add `JWT_SECRET` to `.env` (min 32 characters) for auth.
   - Seed an admin user: `npm run db:seed` (login: `admin@example.com` / `admin123`).

3. **Dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Script               | Purpose                          |
|----------------------|----------------------------------|
| `npm run dev`        | Start Next.js dev server         |
| `npm run build`     | Production build                 |
| `npm run db:generate` | Generate Prisma Client         |
| `npm run db:migrate`  | Apply migrations (interactive)  |
| `npm run db:migrate:deploy` | Apply migrations (CI/prod) |
| `npm run db:studio`  | Open Prisma Studio               |
| `npm run db:seed`    | Seed one Organization + Admin user |

### Phase 1.2 — Auth (backend)

- **POST /api/auth/login** — body `{ "email", "password" }` → returns `{ "token" }` or 401 with generic message.
- **GET /api/auth/me** — requires `Authorization: Bearer <token>`; returns `{ userId, organizationId, role }` or 401.
- Use `requireAuth(request)` from `@/lib/auth` in any API route that needs the current user; it returns 401 if token is missing, invalid, or user is inactive.

Specs (schema, screens, auth, business logic, CSV, implementation order) are in the repo root as Markdown files.
