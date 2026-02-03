# 3PL Asset Tracker — Screen Behavior (MVP)

Exact behavior of each screen. Use with the approved database schema and application outline. No UI or API implementation—behavior and flow only.

**Roles:** Admin and User. Unless a screen says "Admin only," both roles can use it. All data is scoped to the current user’s organization.

---

## 1. Login

**Purpose:** Authenticate the user and start a session.

**Data shown:**
- Email (input).
- Password (input, masked).
- Optional: link to "Forgot password" (MVP can omit; no password-reset flow required).
- Error message when credentials are invalid or account is inactive.

**Actions:**
- Submit: send email + password; if valid and user is active, create session and redirect to Dashboard.
- No "Remember me" or SSO in MVP.

**Role restrictions:** None. Role is determined after login and used for nav and Settings access.

**Validation / guardrails:**
- Email and password required.
- Reject if no user for email in that org, password doesn’t match, or `is_active` is false.
- Show a single generic error (e.g. "Invalid email or password") on failure; do not reveal whether email exists.

---

## 2. Dashboard

**Purpose:** Show a quick summary of asset counts so the user can see overall state and spot issues.

**Data shown:**
- Total asset count (all statuses).
- Counts by status: In use, Idle, Damaged, Lost (each with number).
- Counts by ownership: Company-owned, Client-owned (each with number).
- Optional for MVP: short list of "Needs attention" — e.g. assets with status Damaged or Lost (limit 5–10 with link to full list). If omitted, keep the screen to counts only.

**Actions:**
- None required. Optional: each count or block can link to the Assets list with the relevant filter applied (e.g. "Damaged" links to Assets list filtered by status = damaged).

**Role restrictions:** None. Admin and User see the same dashboard for their org.

**Validation / guardrails:**
- All counts and lists are for the current organization only.
- Counts must be consistent with the Assets table (no caching that can go stale beyond normal request/response).

---

## 3. Assets – List view

**Purpose:** Browse, search, and filter assets so the user can find an asset or review many at once.

**Data shown:**
- Table with one row per asset. Columns: Label ID, Type (asset type name), Owner (company-owned or client name), Warehouse, Zone, Status, Last updated (updated_at). Optional: Notes (truncated) or omit for MVP.
- Empty state when there are no assets (or no assets match the current filters): short message and link/button to create first asset.

**Actions:**
- **Search:** By label ID (substring or exact, implementation choice). Search applies in addition to filters.
- **Filter:** By asset type, status, owner (company vs client, or by specific client), warehouse, zone. Filters are optional and combinable.
- **Sort:** By at least label ID and last updated; optional: type, status, warehouse, zone.
- **Row click / "View":** Navigate to Asset detail for that asset.
- **"Create asset" button:** Navigate to Create asset. Available to both Admin and User.

**Role restrictions:** None. Admin and User both see the list and can open detail and create.

**Validation / guardrails:**
- Only assets for the current organization.
- Zone column shows zone name; if zone exists, warehouse can be shown via zone’s warehouse (or stored warehouse on asset). Location shown as warehouse + zone when both set; otherwise show "—" or "Not set" for missing location.
- Pagination or virtual scrolling if the list is large; define a sensible default page size (e.g. 25 or 50).

---

## 4. Assets – Create asset

**Purpose:** Add a new physical asset to the system with its initial type, ownership, location, and status.

**Data shown:**
- Form fields:
  - **Label ID** (required). Human-readable ID (e.g. PLT-001). Must be unique in the org.
  - **Asset type** (required). Dropdown or select from org’s asset types (name/code).
  - **Owner** (required conceptually; "company-owned" vs "client-owned"). If client-owned, show **Client** dropdown (required when "client-owned" is selected); options = org’s clients. If company-owned, client_id is null.
  - **Warehouse** (optional). Dropdown of org’s warehouses. Can be empty for "With client," "In transit," "Unknown," etc.
  - **Zone** (optional). Dropdown of zones; list only zones for the selected warehouse. If no warehouse selected, zone dropdown empty or disabled. Can be empty.
  - **Status** (required). One of: In use, Idle, Damaged, Lost.
  - **Notes** (optional). Free text.
- Buttons: Submit (create), Cancel (navigate back without saving).

**Actions:**
- Submit: validate; if valid, insert Asset row (and optionally one AssetHistory row for "created" if you record creation in history). Then redirect to Asset detail or back to list with success message.
- Cancel: go back to Assets list (or previous screen) without saving.

**Role restrictions:** None. Both Admin and User can create assets.

**Validation / guardrails:**
- Label ID: required; must be unique for (organization_id, label_id). Trim whitespace. Show clear error if duplicate.
- Asset type: required; must be an asset type belonging to the org.
- Owner: if "client-owned," client_id required and must be an org client. If "company-owned," client_id must be null.
- Warehouse: optional; if present, must be an org warehouse.
- Zone: optional; if present, must belong to the selected warehouse (zone.warehouse_id = selected warehouse_id).
- Status: required; one of the four allowed values.
- Notes: optional; length limit (e.g. 2000 chars) to match schema/DB.

---

## 5. Assets – Asset detail / edit

**Purpose:** View one asset’s full record and update its location, status, ownership, or notes when responsibility or condition changes.

**Data shown:**
- **View mode:** All asset fields: Label ID, Type, Owner (company or client name), Warehouse, Zone, Status, Notes, Created at, Last updated. Read-only until user clicks Edit.
- **Edit mode:** Same fields as Create asset form, with current values. Label ID can be editable or read-only; if editable, same uniqueness rule applies (excluding current asset). Warehouse/Zone dropdowns behave as in Create (zones filtered by warehouse).
- Optional for MVP: **History** — list of recent changes (from AssetHistory): changed_at, user (full_name or email), and a short summary (e.g. "Status → Damaged" or "Location → WH-1 / A-01"). Last 5–10 entries with link to "View all" if you support a fuller history view; otherwise last 5 is enough.

**Actions:**
- **Edit:** Switch to edit mode (or navigate to edit route).
- **Save:** Validate; if valid, update Asset row and insert one AssetHistory row (user_id = current user, changed_at = now, snapshot = asset state after update). Then show success and stay on detail or switch back to view mode.
- **Cancel:** Discard edits and return to view mode (or list) without saving.
- **Back:** Navigate to Assets list.

**Role restrictions:** None. Both Admin and User can view and edit.

**Validation / guardrails:**
- Same as Create asset for each field (label_id uniqueness, zone belongs to warehouse, status enum, etc.). If label_id is read-only on edit, no uniqueness check on save for that field.
- Only assets belonging to the current org can be viewed or edited.
- AssetHistory: on save, snapshot must reflect the new state (e.g. status, warehouse_id, zone_id, client_id) so "previous" state is the previous history row.

---

## 6. Locations – Warehouses

**Purpose:** Maintain the list of warehouses for the organization so assets can be assigned to a location.

**Data shown:**
- List of warehouses: name, code (if present), and optionally count of zones or assets. Empty state if none: message and button to add first warehouse.

**Actions:**
- **Add warehouse:** Open form (inline or new screen). Fields: Name (required), Code (optional). Save creates Warehouse row; redirect or refresh list.
- **Edit warehouse:** Open form with existing name/code. Save updates the warehouse.
- **Delete warehouse:** Confirm (e.g. "Are you sure?"). Only allow if no zones and no assets reference this warehouse; otherwise show message like "Cannot delete: this warehouse has zones or assets" and list what’s blocking (zones count, assets count). Do not delete if blocked.

**Role restrictions:** None. Both Admin and User can manage warehouses.

**Validation / guardrails:**
- Name required. Code optional. No uniqueness constraint required for MVP.
- Delete: prevent if warehouse has any zones or any assets with this warehouse_id. Check both.

---

## 7. Locations – Zones

**Purpose:** Maintain zones within each warehouse so assets can be assigned to a warehouse + zone.

**Data shown:**
- List of zones. Each row: Zone name (and code if present), Warehouse name. Optionally show zone count per warehouse. Empty state if no zones.

**Actions:**
- **Add zone:** Form: Warehouse (required, dropdown of org warehouses), Name (required), Code (optional). Save creates Zone row; redirect or refresh list.
- **Edit zone:** Form with warehouse, name, code. Save updates the zone. Changing warehouse is allowed (zone moves to another warehouse).
- **Delete zone:** Confirm. Only allow if no assets reference this zone (asset.zone_id). If any asset has this zone_id, show "Cannot delete: X assets use this zone" and do not delete.

**Role restrictions:** None. Both Admin and User can manage zones.

**Validation / guardrails:**
- Warehouse required (must be org’s warehouse). Name required. Code optional.
- Delete: prevent if any asset has zone_id = this zone.

---

## 8. Clients

**Purpose:** Maintain the list of clients used to mark "client-owned" assets so ownership is clear and consistent.

**Data shown:**
- List of clients: name and optionally count of assets owned by this client. Empty state if none.

**Actions:**
- **Add client:** Form: Name (required). Save creates Client row; redirect or refresh list.
- **Edit client:** Form with current name. Save updates the client.
- **Delete client:** Confirm. Only allow if no assets have client_id = this client. If any do, show "Cannot delete: X assets are assigned to this client" and do not delete. Optionally offer "Unassign those assets (set to company-owned)" and then delete; for MVP, simple "cannot delete while in use" is enough.

**Role restrictions:** None. Both Admin and User can manage clients.

**Validation / guardrails:**
- Name required. No uniqueness required for MVP.
- Delete: prevent if any asset has client_id = this client (or implement unassign-then-delete as above; document which you chose).

---

## 9. Reports (export)

**Purpose:** Let the user filter assets and export the result to CSV (and optionally Excel) for internal use or sharing with clients.

**Data shown:**
- Filter form: Date range (e.g. "Last updated" from/to), Asset type (dropdown, optional), Status (optional), Owner (company vs client, or specific client, optional), Warehouse (optional), Zone (optional). All filters optional.
- Optional: preview table of matching rows (same columns as Assets list, paginated) so user can confirm before export. If no preview, user applies filters and clicks Export.
- Button: "Export CSV" (and "Export Excel" if in scope).

**Actions:**
- Apply filters: update preview (if any) or just store filter state.
- **Export CSV:** Generate file with columns matching the data model (e.g. Label ID, Type, Owner, Warehouse, Zone, Status, Notes, Last updated). Rows = assets for current org that match the current filters. Filename can include org name and date (e.g. assets_export_2025-02-03.csv).
- **Export Excel:** Same as CSV in a spreadsheet format if implemented.

**Role restrictions:** None. Both Admin and User can run and export reports.

**Validation / guardrails:**
- Date range: if provided, filter assets by updated_at (or created_at) within range. Validate "from" ≤ "to."
- All filters are optional; no filters = all org assets.
- Export only includes data for the current organization. No row-level permissions beyond org.

---

## 10. Settings – Organization

**Purpose:** Let an Admin view and edit the organization’s name (and optional billing contact if stored).

**Data shown:**
- Current organization name (and billing contact if applicable). Form or inline edit.

**Actions:**
- **Save:** Update organization name (and optional billing contact). Redirect or show success; no navigation away from Settings required.

**Role restrictions:** Admin only. Users with role "user" do not see this screen or see a "no access" message.

**Validation / guardrails:**
- Organization name required. Billing contact optional if the schema has it.
- Only one organization per account; no "switch org" or create org here.

---

## 11. Settings – Users (Admin only)

**Purpose:** Let an Admin see who has access and invite new users or deactivate existing ones.

**Data shown:**
- List of users: email, full name (if set), role (Admin / User), status (Active / Inactive), created date. Do not show password or password_hash. Current user can be marked so Admin doesn’t deactivate themselves by mistake.

**Actions:**
- **Invite user:** Open form: Email (required), Role (Admin or User). Submit: create User row (organization_id = current org, email, role, is_active = true, password_hash = null or temporary until first login). Send invite email with a signed link so the user can set their password (implementation detail; no invite-token table required if using signed link). Show success and optionally "Invite sent."
- **Deactivate user:** Confirm (e.g. "Deactivate [email]? They will not be able to log in."). Set user’s is_active = false. Do not allow deactivating the current user (disable button or hide action for self).
- No "Edit user" (change email/role) in MVP unless you explicitly add it; otherwise invite new and deactivate old if needed.

**Role restrictions:** Admin only. Users with role "user" do not see this screen.

**Validation / guardrails:**
- Invite: email required; must be unique per organization (reject with clear message if email already exists for this org). Role required.
- Deactivate: cannot deactivate the currently logged-in user. After deactivation, that user’s next login attempt must fail with the same generic "Invalid email or password" (or "Account is inactive") so we don’t reveal status.
- Do not list or allow deletion of users from a different organization (already enforced by org scope).

---

## Summary

| Screen              | Purpose                          | Admin | User | Notes                                      |
|---------------------|----------------------------------|-------|------|--------------------------------------------|
| Login               | Authenticate                     | ✓     | ✓    | Same flow for both roles                   |
| Dashboard           | Summary counts                   | ✓     | ✓    | Optional "needs attention"                 |
| Assets – List       | Browse, search, filter           | ✓     | ✓    | Link to detail and create                 |
| Assets – Create     | Add asset                        | ✓     | ✓    | label_id unique per org                    |
| Assets – Detail/Edit| View and update asset            | ✓     | ✓    | Save writes Asset + AssetHistory           |
| Locations – Warehouses | Manage warehouses            | ✓     | ✓    | No delete if zones/assets reference       |
| Locations – Zones   | Manage zones                     | ✓     | ✓    | No delete if assets reference             |
| Clients             | Manage clients                   | ✓     | ✓    | No delete if assets reference             |
| Reports             | Filter and export CSV/Excel      | ✓     | ✓    | All filters optional                       |
| Settings – Org      | Edit org name                    | ✓     | —    | Admin only                                 |
| Settings – Users    | Invite, deactivate users         | ✓     | —    | Admin only; no self-deactivate            |

All list/detail/create/edit screens operate only on data for the current user’s organization.
