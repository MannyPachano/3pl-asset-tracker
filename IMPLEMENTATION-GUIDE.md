# 3PL Asset Tracker — Project Structure and Implementation Order

Uses the fully approved specs. No code; structure and order only. MVP scope.

---

## PART A — Project structure

Recommended layout for a modern web app with separate frontend and backend (or a full-stack monorepo with clear separation). Adapt paths if you use a single framework (e.g. Next.js app router) that merges routes and API in one tree.

### Top-level layout

```
3pl-asset-tracker/
  backend/           # API, business logic, DB access
  frontend/          # UI, pages, client state
  docs/              # Approved specs (optional; or keep at repo root)
```

Alternatively, a **monorepo** with packages or a **single app** (e.g. Next.js):

```
3pl-asset-tracker/
  app/               # Or src/ — routes, pages, API routes if combined
  lib/               # Shared or server-only logic
  packages/          # Optional: backend + frontend as packages
  docs/
```

Below uses **backend/** and **frontend/** for clarity; map to your chosen stack.

---

### Backend structure

```
backend/
  api/                     # HTTP entry points
    routes/                 # Or controllers/
      auth/                 # Login, logout, session/refresh if needed
      assets/              # CRUD + list, search, filters
      locations/           # Warehouses, zones
      clients/             # Clients CRUD
      reports/             # Export (CSV)
      settings/            # Org (Admin), users (Admin)
    middleware/            # Auth middleware, error handling
      auth.go / auth.ts     # Verify token/session, attach user/org to request
      requireAdmin.ts      # Optional: 403 if not Admin

  core/                    # Or domain/ — business logic (no HTTP)
    asset/                 # Asset create/update/delete + validation
      create.ts
      update.ts
      delete.ts
      validate.ts          # Shared validation rules
    asset-history/         # When and how to write history rows
      write-history.ts
    csv/
      import/              # Parse CSV, validate rows, resolve refs, insert
        parser.ts
        validate-row.ts
        resolve-refs.ts     # asset_type, client, warehouse, zone by name/code
        run-import.ts      # Orchestrate: parse → validate → insert → response
      export/              # Apply filters, build rows, stream/write CSV
        build-export.ts
        filters.ts

  data/                    # Or db/, persistence/
    schema/                # Source of truth for tables
      migrations/          # Versioned SQL or migration files
        001_initial.sql
        002_...
    repositories/          # Or adapters/ — one per aggregate/entity
      organization.ts
      user.ts
      asset-type.ts
      client.ts
      warehouse.ts
      zone.ts
      asset.ts
      asset-history.ts
    db.ts                  # Connection, transaction helper

  config/                  # Env, feature flags if any
  lib/                     # Shared utils (hashing, tokens, dates)
```

**Where things live:**

- **Schema / migrations:** `backend/data/schema/migrations/`. Versioned files; run in order. No ORM required; raw SQL or an ORM’s migration output both go here.
- **CSV logic:** `backend/core/csv/import/` (parse, validate, resolve, run) and `backend/core/csv/export/` (filters, build rows, format). API entry in `backend/api/routes/reports/` (export) and e.g. `backend/api/routes/assets/import` or under `assets/` (import).
- **Auth middleware / guards:** `backend/api/middleware/`. One piece that: reads token/session, loads user (and org, role), attaches to request, returns 401 if invalid. Optional second piece that returns 403 if `role !== admin` for Admin-only routes. Applied to all tenant routes; login route excluded.

---

### Frontend structure

```
frontend/
  app/                     # Or pages/ — file-based routing
    (auth)/                # Optional route group
      login/
        page.tsx
    (app)/                 # Authenticated layout
      layout.tsx            # Shell: header, nav, current user/org
      dashboard/
        page.tsx
      assets/
        page.tsx           # List
        new/
          page.tsx         # Create
        [id]/
          page.tsx         # Detail + edit
      locations/
        warehouses/
          page.tsx
        zones/
          page.tsx
      clients/
        page.tsx
      reports/
        page.tsx           # Filters + export
      settings/
        organization/
          page.tsx         # Admin only
        users/
          page.tsx         # Admin only

  components/              # Reusable UI
    ui/                    # Buttons, inputs, table, modals
    assets/                # Asset form, asset table, filters
    locations/             # Warehouse/zone forms and lists
    clients/               # Client form and list
    layout/                # Header, sidebar, shell

  lib/                     # Client-side helpers
    api.ts                 # Fetch wrapper (auth header, base URL, errors)
    auth.ts                # Token storage, logout, getCurrentUser if needed
    constants.ts            # Status options, etc.

  hooks/                   # Optional: useAuth, useOrg, useAssets
```

**Where concerns live:**

- **Auth:** Login page under `app/(auth)/login/`; token/session handling in `lib/auth.ts`; protected layout in `(app)/layout.tsx` (redirect to login if unauthenticated). No auth logic in components beyond “call login API” and “attach token to requests.”
- **Assets:** Pages under `app/(app)/assets/`; forms and tables in `components/assets/`; API calls use `lib/api.ts`; backend owns validation and history.
- **Locations / clients / reports / settings:** Same idea: pages in `app/(app)/...`, shared components in `components/`, API in `lib/api.ts` or route-specific calls.

---

### Cross-cutting

- **Environment:** Backend and frontend each have env (e.g. `BACKEND_URL`, `DATABASE_URL`, `JWT_SECRET`). No secrets in frontend except what’s needed for public config (e.g. API base URL).
- **Types:** Shared types (Asset, AssetType, Client, Warehouse, Zone, User, etc.) can live in a **shared/** package or be duplicated in backend and frontend. For MVP, duplicating DTOs in each is fine; keep field names aligned with schema and API contracts.

---

## PART B — Implementation order

Build in this order. Each step ends with a checkpoint: something you can run and verify.

---

### Phase 1 — Foundation

**Step 1.1 — Repo, DB, schema**

- Create project (monorepo or separate backend/frontend).
- Add Postgres (or equivalent); create DB and connection.
- Add migrations folder; implement initial schema (Organization, User, AssetType, Client, Warehouse, Zone, Asset, AssetHistory) per approved schema.
- Run migrations; confirm tables exist.

*Checkpoint: DB connects; all tables present.*

---

**Step 1.2 — Auth (backend)**

- Implement user lookup by email (and org if needed), password check, `is_active` check.
- Implement token issue (e.g. JWT with user id, organization_id, role) and validation.
- Add auth middleware: on each request (except login), validate token, load user/org, attach to request; return 401 if invalid or inactive.
- Expose login endpoint (email + password → token or session); no registration in MVP (users created by Admin later).
- Seed one Organization and one Admin User (script or migration) so you can log in.

*Checkpoint: POST /login with seeded credentials returns token; request with valid token is accepted; request without or with invalid token gets 401.*

---

**Step 1.3 — Auth (frontend)**

- Add login page: email, password, submit. Call login API; store token (e.g. memory or localStorage); redirect to dashboard.
- Add authenticated app layout: read token; if missing, redirect to login. Show simple header with org name and logout (clear token, redirect to login).
- Wire logout.

*Checkpoint: Can log in, see dashboard shell, log out. Unauthenticated access redirects to login.*

---

### Phase 2 — Core data and assets

**Step 2.1 — Locations and lookup data (backend)**

- Implement Warehouse CRUD (list, create, update, delete with guard: no delete if zones or assets reference it). All scoped to current org.
- Implement Zone CRUD (list, create, update, delete with guard: no delete if assets reference it). Zones scoped via warehouse’s org.
- Implement AssetType list + create + update (and optional delete). Scoped to org. Seed default types (Pallet, Tote, Cage, Bin) per org on first use or via migration.
- Implement Client CRUD; scoped to org; no delete if assets reference.

*Checkpoint: API can list/create/update/delete warehouses, zones, asset types, clients for the logged-in org.*

---

**Step 2.2 — Locations and lookup data (frontend)**

- Settings or a “setup” flow: Warehouses list + add/edit; Zones list + add/edit (zone form includes warehouse picker); Asset types list + add/edit; Clients list + add/edit.
- Nav links to Locations (warehouses, zones) and Clients. No Reports or Settings yet if not built.

*Checkpoint: Can create warehouses, zones, asset types, and clients in the UI.*

---

**Step 2.3 — Asset CRUD (backend)**

- Implement Asset create: validation (label_id uniqueness, asset_type, client, warehouse, zone, status), zone–warehouse rule, org from auth. Optional: one AssetHistory row on create (snapshot).
- Implement Asset update: load by id, verify org, same validation (label_id unique excluding self), write AssetHistory row (snapshot = state after update) in same transaction.
- Implement Asset delete: only when zero AssetHistory rows; verify org; 404/409 per spec.
- Implement Asset list: filters (type, status, owner, warehouse, zone), search by label_id, sort, pagination. All scoped to org.
- Implement Asset get-by-id (detail); 404 if wrong org.

*Checkpoint: API supports full Asset CRUD and list with filters; history row written on update (and optionally on create).*

---

**Step 2.4 — Assets (frontend)**

- Assets list page: table (label_id, type, owner, warehouse, zone, status, last updated), filters, search, link to detail, “Create asset” button.
- Create asset page: form with label_id, type, client (optional), warehouse, zone, status, notes; submit → create; errors shown (e.g. duplicate label_id).
- Asset detail page: show all fields; Edit mode same fields; save → update; optional: show last few history entries.

*Checkpoint: Can create, list, view, and edit assets in the UI; validation errors (e.g. duplicate label) shown.*

---

### Phase 3 — Dashboard and reports

**Step 3.1 — Dashboard (backend + frontend)**

- Backend: endpoint or reuse list logic to return counts (total assets, by status, by owner). Or compute in frontend from list response if acceptable for MVP.
- Frontend: Dashboard page with summary counts (total, by status, by owner). Optional: “Needs attention” (damaged/lost) linking to filtered asset list.

*Checkpoint: After login, dashboard shows correct counts.*

---

**Step 3.2 — Export (backend)**

- Implement export: accept same filters as Reports (date range, type, status, owner, warehouse, zone). Query assets for current org; build CSV (columns: Label ID, Asset Type, Owner, Warehouse, Zone, Status, Notes, Last Updated). Apply date/time format and file naming per CSV spec. Stream or buffer; set Content-Disposition. Enforce optional max rows if defined.

*Checkpoint: Export API returns CSV file with correct columns and filters.*

---

**Step 3.3 — Reports (frontend)**

- Reports page: filter form (date range, type, status, owner, warehouse, zone); “Export CSV” button that calls export API and triggers download with expected filename.

*Checkpoint: Can apply filters and download CSV export.*

---

### Phase 4 — Settings and users

**Step 4.1 — Settings (backend)**

- Organization: get and update (name, optional billing contact) for current org. Admin-only: enforce role in middleware or route.
- Users: list users for current org (Admin only). Invite: create user (email, role, org from auth, is_active true, password null or temp); send invite (e.g. email with set-password link). Deactivate: set is_active = false; block self-deactivation.

*Checkpoint: Admin can update org and list users; can invite (email + role) and deactivate another user; cannot deactivate self.*

---

**Step 4.2 — Settings (frontend)**

- Settings – Organization: form to edit org name; visible only to Admin (hide nav or show 403).
- Settings – Users: list users (email, role, status); “Invite” (email + role); “Deactivate” (disabled for current user). Nav to Settings only for Admin.

*Checkpoint: Admin can manage org and users in the UI; User role does not see Settings.*

---

### Phase 5 — CSV import

**Step 5.1 — CSV import (backend)**

- Implement CSV import per spec: parse UTF-8 CSV; normalize headers; validate each row (required fields, label_id unique in file and vs DB, resolve asset_type/client/warehouse/zone in org, zone–warehouse rule, status enum). Collect errors; insert only valid rows in one or more transactions. No AssetHistory on import. Response: total_rows, imported, failed, errors[] (row, label_id, message). Enforce max file size and max rows; reject whole file for bad header/encoding/size.

*Checkpoint: Import API accepts CSV and returns correct counts and error list; only valid rows inserted.*

---

**Step 5.2 — CSV import (frontend)**

- Add import entry point: e.g. “Import” on Assets list or a dedicated Import page. File input; upload CSV; show result (imported count, failed count, list of errors with row and message). Optionally offer template or column instructions.

*Checkpoint: Can upload a CSV and see success/error report; failed rows are identifiable.*

---

### Phase 6 — Polish and guardrails

**Step 6.1 — Guardrails and errors**

- Confirm all tenant reads/writes use current user’s org; 404 for other org’s resources. Confirm Admin-only routes return 403 for User. Confirm self-deactivation blocked. Confirm duplicate label_id, zone–warehouse, and delete-with-history return the right status and message per spec.
- Centralize error responses and logging (login failure, 403, 404, validation, 409) per AUTH-RULES and ASSET-BUSINESS-LOGIC.

*Checkpoint: Cross-org, role, and validation behaviors match specs; errors and logs are consistent.*

---

**Step 6.2 — Set-password flow (invited users)**

- Invited user has no password. Implement set-password flow: link in email contains signed token (e.g. JWT with user id, exp); page to enter new password; submit updates user’s password_hash; token invalidated or one-time. After that, user can log in with email + new password.

*Checkpoint: Invited user can set password and log in.*

---

### Order summary

| Phase | Steps | Main checkpoint |
|-------|--------|------------------|
| 1 | 1.1–1.3 | DB + auth: login, token, protected layout |
| 2 | 2.1–2.4 | Locations, clients, asset types; full Asset CRUD in UI |
| 3 | 3.1–3.3 | Dashboard counts; CSV export and Reports page |
| 4 | 4.1–4.2 | Settings (org + users); Admin-only; invite/deactivate |
| 5 | 5.1–5.2 | CSV import API + UI |
| 6 | 6.1–6.2 | Guardrails, errors, set-password for invited users |

Build in this order so each phase delivers a testable slice and the app is usable after Phase 2 (core assets) and fully MVP-complete after Phase 6.
