# Deploying 3PL Asset Tracker

You need:
- **PostgreSQL** database (hosted)
- **Environment variables:** `DATABASE_URL`, `JWT_SECRET`
- Run **migrations** (and optionally **seed**) against the production DB once

---

## Option 1: Vercel (app) + Neon or Supabase (Postgres)

### 1. Create a Postgres database

- **[Neon](https://neon.tech)** (free tier): Create project → copy the connection string.
- **[Supabase](https://supabase.com)** (free tier): Project Settings → Database → Connection string (URI).
- **[Vercel Postgres](https://vercel.com/storage/postgres)**: If you use Vercel, you can attach a Postgres store and get `DATABASE_URL` automatically.

Use the **pooled** or **direct** connection string (e.g. `postgresql://user:pass@host/db?sslmode=require`).

### 2. Deploy to Vercel

1. Push your code to **GitHub** (or GitLab/Bitbucket).
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import your repo.
3. **Environment variables** (Project Settings → Environment Variables):
   - `DATABASE_URL` = your Postgres connection string (e.g. from Neon/Supabase).
   - `JWT_SECRET` = a long random string (32+ chars); e.g. `openssl rand -base64 32`.
4. **Build command:** `npm run build` (default).  
   The `postinstall` script in `package.json` runs `prisma generate` before build.
5. Deploy. After the first deploy, run migrations (see below).

### 3. Run migrations and seed (once)

From your **local machine** (with production `DATABASE_URL` in `.env`), or use Vercel’s run command / a one-off script:

```bash
# Set DATABASE_URL to your production DB, then:
npx prisma migrate deploy
npm run db:seed   # creates Acme 3PL + admin@example.com / admin123
```

Or use **Neon/Supabase SQL editor** and run the SQL from `prisma/migrations/20250203000000_initial/migration.sql` if you prefer.

---

## Option 2: Railway (app + Postgres in one place)

1. Go to [railway.app](https://railway.app) and create a project.
2. **Add PostgreSQL:** New → Database → PostgreSQL. Railway sets `DATABASE_URL` for you.
3. **Add your app:** New → GitHub repo → select this repo.
4. In the service **Variables**, add:
   - `JWT_SECRET` = long random string (32+ chars).
   - `DATABASE_URL` is usually set automatically from the Postgres plugin; if not, copy it from the Postgres service.
5. **Build command:** `npm run build`  
   **Start command:** `npm start`  
   **Root directory:** (leave default)
6. **Deploy.** Then run migrations once (Railway CLI or connect to the DB and run `prisma migrate deploy` from your machine with `DATABASE_URL` pointing to Railway’s Postgres).

---

## Option 3: Render (app + Postgres)

1. [render.com](https://render.com) → New → **PostgreSQL** (create a DB; note the internal or external URL).
2. New → **Web Service** → connect repo.
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
3. In the Web Service **Environment**, add:
   - `DATABASE_URL` = Render Postgres URL (from the DB you created).
   - `JWT_SECRET` = long random string (32+ chars).
4. Deploy, then run migrations once (e.g. from your laptop with `DATABASE_URL` set to the Render Postgres URL):

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

---

## Checklist

| Step | What to do |
|------|------------|
| 1 | Create a **PostgreSQL** database (Neon, Supabase, Railway, Render, etc.). |
| 2 | Set **`DATABASE_URL`** and **`JWT_SECRET`** in your hosting dashboard. |
| 3 | Deploy the app (Vercel / Railway / Render). |
| 4 | Run **`npx prisma migrate deploy`** against the production DB (once). |
| 5 | Run **`npm run db:seed`** if you want the default org and admin user (once). |
| 6 | Log in at **admin@example.com** / **admin123** (if you ran seed). Change the password in production. |

---

## Security notes

- Use **HTTPS** (Vercel/Railway/Render provide it).
- Use a **strong, unique `JWT_SECRET`** in production (e.g. `openssl rand -base64 32`).
- Change the **seed admin password** after first login, or avoid running seed in production and create the first user via another channel.
