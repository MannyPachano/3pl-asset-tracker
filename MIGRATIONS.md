# Database migrations (Phase 1.1)

This project uses **Prisma** with **PostgreSQL**. The schema matches `DATABASE-SCHEMA.md` exactly.

## Prerequisites

- Node.js 18+
- PostgreSQL running locally or remotely
- A database created (e.g. `3pl_asset_tracker`)

## 1. Environment

Create a `.env` file in the project root (do not commit it):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
JWT_SECRET="your-secret-at-least-32-characters-long"
```

Example for local Postgres with default user and a database named `3pl_asset_tracker`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/3pl_asset_tracker?schema=public"
JWT_SECRET="your-secret-at-least-32-characters-long"
```

Replace `USER`, `PASSWORD`, `HOST`, and `DATABASE` with your values. `JWT_SECRET` is required for auth (Phase 1.2); use a long random string in production.

## 2. Run migrations locally

**First time (create DB and apply migrations):**

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

- `prisma generate` — generates the Prisma Client (no DB required).
- `prisma migrate deploy` — applies all pending migrations in `prisma/migrations/` to the database. Use this for a clean DB or in production.

**During development (after changing `prisma/schema.prisma`):**

```bash
npx prisma migrate dev --name your_migration_name
```

This applies pending migrations and updates the migration history. Use it when you have a local dev DB and are iterating on the schema.

## 3. Verify

- Tables should exist: `Organization`, `User`, `AssetType`, `Client`, `Warehouse`, `Zone`, `Asset`, `AssetHistory`.
- Optional: open Prisma Studio to inspect data: `npx prisma studio`

## 4. Seed (Phase 1.2 — auth)

After migrations, create one Organization and one Admin user for login:

```bash
npm run db:seed
```

Seeded admin: **email** `admin@example.com`, **password** `admin123`. Change the password after first login in production.

## 5. Scripts (package.json)

- `npm run db:generate` — generate Prisma Client
- `npm run db:migrate` — run `prisma migrate dev` (interactive, for development)
- `npm run db:migrate:deploy` — run `prisma migrate deploy` (non-interactive, for CI/production)
- `npm run db:seed` — seed one org and one admin user
- `npm run db:studio` — open Prisma Studio
