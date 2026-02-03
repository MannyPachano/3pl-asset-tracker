# 3PL Asset Tracker — Application Outline

High-level outline for a B2B web app that tracks physical logistics assets (pallets, totes, containers, bins, cages, handling equipment) for small–mid 3PL companies. Desktop-first, manual updates only, one organization per account.

---

## 1. Core entities (data models)

### Organization
- Single tenant: one organization per account.
- Name, billing contact (for $799/year assumption; invoicing/payment is out of scope for MVP).

### User
- Email, password (simple auth).
- Role: **Admin** or **User**.
- Belongs to one organization.

### Asset type
- Kind of physical thing: pallet, tote, container, bin, cage, hand truck, etc.
- **Seeded + editable**: ship with defaults (e.g. Pallet, Tote, Cage, Bin); org can edit and add. Simple lookup table.
- Name and optional short code (e.g. "Pallet", "PLT"). Used to categorize assets and filter reports.

### Asset
- Human-readable **ID** (label), e.g. "PLT-001", "TOTE-A42".
- **Asset type** (FK).
- **Owner**: company-owned vs client-owned.
- **Location**: warehouse + zone (both required when assigned).
- **Status**: In use | Idle | Damaged | Lost.
- Created-at, last-updated-at.
- Optional notes (free text).

### Location
- **Warehouse**: name/code (e.g. "DC-East", "WH-1").
- **Zone**: name/code within a warehouse (e.g. "Receiving", "A-01").
- Location = warehouse + zone. Zones are scoped to a warehouse.

### Client (for ownership)
- Name (e.g. "Acme Corp").
- Used only to indicate “client-owned” assets; no invoicing or contracts in MVP.

### Audit / history (optional for MVP)
- If included: log of changes to asset (location, status, owner) with user and timestamp. Otherwise defer.

---

## 2. Core screens / pages

### Authentication
- **Login**: email + password.
- **Logout**.
- (Password reset can be MVP or deferred; not in “future features,” just optional.)

### After login (app shell)
- Shared header: org name, user name, logout.
- Navigation: Dashboard, Assets, Locations, Reports, (Settings / Users if Admin).

### Dashboard
- Summary counts: total assets, by status (in use, idle, damaged, lost), by owner (company vs client).
- Optional: recent activity or “assets needing attention” (e.g. damaged, lost) — keep minimal for MVP.

### Assets
- **List view**: table of assets with columns — ID, type, owner, warehouse, zone, status, last updated. Sort, filter by type, status, owner, warehouse.
- **Create asset**: form — ID, type, owner, warehouse, zone, status, notes.
- **Asset detail**: view single asset; **Edit** to change location, status, owner, notes.
- **Search** by asset ID (and optionally type/status) for quick lookup.

### Locations
- **Warehouses**: list; add / edit warehouse (name/code).
- **Zones**: list per warehouse (or combined list with warehouse column); add / edit zone (name/code, parent warehouse).

### Reports
- **Export**: filter by date range, asset type, status, owner, warehouse/zone; export to CSV (and optionally Excel). Predefined report: “All assets,” “Assets by location,” “Assets by status,” “Client-owned assets.”

### Settings (Admin only)
- **Organization**: view/edit org name (and billing contact if stored).
- **Users**: list users; invite (email + role) or deactivate. No self-service signup in MVP — Admin creates users.

---

## 3. Core workflows

### Onboarding (one-time)
1. Admin signs up or is created (if you support a single “first user” signup).
2. Admin creates organization (or it’s created with first user).
3. Admin adds warehouses and zones.
4. Admin adds asset types.
5. Admin (or User) starts adding assets.

### Daily operations
1. **Record new assets**: User/Admin creates asset with ID, type, owner, location, status.
2. **Update when something changes**: User opens asset, edits location (e.g. moved to another zone), status (e.g. damaged, lost), or owner (e.g. client ownership change).
3. **Lookup**: Search by ID or filter list to find asset and confirm location/status/owner.
4. **Settle disputes**: Use asset history (if implemented) or at least current state + exports to show where an asset is and who owns it.

### Reporting
1. User applies filters (type, status, owner, warehouse, date range).
2. User exports CSV (and optionally Excel) for internal use or to share with clients.

### User management (Admin)
1. Admin invites user (email + role).
2. User receives invite (email with link or instructions; implementation detail).
3. User sets password and logs in.
4. Admin can deactivate user (user can no longer log in).

---

## 4. Explicit non-goals (what the app will NOT do)

- **No WMS**: No inventory of goods, no pick/pack/ship, no order management, no receiving/putaway workflows.
- **No real-time tracking**: No live location updates, no GPS, no “where is it right now” maps.
- **No automation**: No RFID, barcode scanning, or automatic updates; all changes are manual.
- **No mobile app**: Web only; responsive for desktop-first use.
- **No multi-organization**: One organization per account; no white-label or multi-tenant reseller.
- **No client portal**: Clients do not log in; ownership is a data field, not a separate tenant.
- **No invoicing or billing flows**: Pricing is $799/year per company; no in-app subscriptions, payment, or invoice generation in MVP.
- **No integrations**: No ERPs, WMS, or TMS; no API for external systems in MVP.
- **No advanced analytics**: No dashboards, forecasting, or BI; only exportable list/table reports.
- **No asset lifecycle or maintenance**: No repair workflows, depreciation, or maintenance schedules.
- **No serial/lot tracking of goods**: Only the physical asset (pallet, tote, etc.) is tracked, not what’s on it.

---

## 5. Summary

| Layer        | MVP scope |
|-------------|-----------|
| **Auth**    | Email + password; Admin and User roles; one org per account. |
| **Data**    | Organization, User, Asset type, Asset (ID, type, owner, location, status), Warehouse, Zone, Client (as owner reference). |
| **Screens** | Login; Dashboard; Assets (list, create, detail, edit); Locations (warehouses, zones); Reports (filter + export CSV); Settings (org, users — Admin). |
| **Workflows**| Add/edit assets and locations; update asset location/status/owner; search/filter; export reports; Admin manages users. |
| **Non-goals**| WMS, real-time/GPS/RFID, mobile app, multi-org, client portal, billing, integrations, analytics, maintenance. |

This outline is enough to implement an MVP: one organization, two roles, manual asset and location management, and exportable reports.
