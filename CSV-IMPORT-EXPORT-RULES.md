# 3PL Asset Tracker — CSV Import and Export Rules (MVP)

Exact rules for CSV import (bulk create assets) and CSV export (reporting). Backend behavior and data rules only; no UI or code. Use with the approved schema, screen behavior, auth rules, and asset business logic.

**Scope:** One organization per request. All import rows create assets in the current user’s organization. All export rows are assets from the current user’s organization only.

---

## 1. CSV IMPORT

### 1.1 When CSV import is used

- **Initial setup:** Loading an existing inventory of assets (e.g. from a spreadsheet) when first using the app.
- **Bulk additions:** Adding many new assets at once without creating them one-by-one.

Import creates **new** Asset rows only. There is no "update by CSV" or "upsert" in MVP; duplicate label_id (in file or in DB) is treated as an error for that row.

### 1.2 Required vs optional columns

| Column (see 1.3 for names) | Required | Notes |
|---------------------------|----------|-------|
| label_id | yes | Human-readable asset ID; must be unique per org (and unique within file). |
| asset_type | yes | Resolved to AssetType in current org (by name or code). |
| status | yes | One of: in_use, idle, damaged, lost (exact string, case-sensitive or normalized—define one). |
| client | no | Company-owned if empty; otherwise resolved to Client in current org by name. |
| warehouse | no | Resolved to Warehouse in current org by name or code. |
| zone | no | Resolved to Zone in current org; only valid in combination with warehouse (zone must belong to warehouse). |
| notes | no | Free text. |

**Resolution rules:**

- **asset_type:** Match against AssetType.name or AssetType.code for the current org. If no match or multiple matches (e.g. duplicate names), treat as validation error for that row. Prefer exact match; define whether match is case-sensitive or case-insensitive (e.g. case-insensitive for MVP).
- **client:** Match against Client.name for the current org. If provided and no match (or multiple matches), error. If empty/null, asset is company-owned (client_id = null).
- **warehouse:** Match against Warehouse.name or Warehouse.code for the current org. If provided and no match, error. If empty and zone is provided, error (warehouse required when zone is set).
- **zone:** Match against Zone.name or Zone.code **within the resolved warehouse only**. If warehouse is provided and zone is provided, zone must belong to that warehouse. If zone is provided but warehouse is empty, error. If warehouse is provided and zone is empty, valid (asset at warehouse, no zone).

### 1.3 Column names and formats

**Accepted column names (header row):**

Use a single canonical set; client may send variations. Recommended: accept common variants by normalizing (trim, lowercase) and mapping to canonical names.

| Canonical name | Accepted variants (example) | Format / type |
|----------------|------------------------------|---------------|
| label_id | label_id, Label ID, label id, LabelId | Non-empty string after trim. Uniqueness enforced per org and within file. |
| asset_type | asset_type, Asset Type, asset type, AssetType, type | String; resolved to org’s AssetType by name or code. |
| status | status, Status | String: `in_use`, `idle`, `damaged`, `lost`. Define if case-insensitive (e.g. normalize to lowercase before validate). |
| client | client, Client, owner | String; empty = company-owned. Resolved to org’s Client by name. |
| warehouse | warehouse, Warehouse, warehouse_name | String; empty = no location. Resolved to org’s Warehouse. |
| zone | zone, Zone, zone_name | String; empty = no zone. Resolved within warehouse. |
| notes | notes, Notes | String; optional. Apply same length limit as Asset.notes. |

**Format rules:**

- **Encoding:** UTF-8. Reject or fail gracefully if file is not valid UTF-8 (or document that other encodings are not supported).
- **Delimiter:** Comma (,). No other delimiters in MVP.
- **Header:** First row is the header. Required. Column order does not matter; columns are identified by name (after normalization).
- **Quoting:** Standard CSV: fields containing comma, newline, or double-quote should be quoted; double-quote inside field escaped as "". Parser must handle quoted fields.
- **Empty cells:** Treated as null/empty for optional columns; for required columns (label_id, asset_type, status), empty = validation error.
- **Whitespace:** Trim leading/trailing spaces from cell values before validation and resolution. Empty after trim = empty.
- **Row limit:** Define a maximum number of data rows (e.g. 10,000) to avoid timeouts and abuse. Reject entire file with 413 or 422 if exceeded.

### 1.4 How rows are validated

- Apply validation in the same logical order as single-asset create (see Asset business logic):
  1. **Required fields:** label_id, asset_type, status must be non-empty after trim.
  2. **label_id uniqueness (within file):** No two rows may have the same label_id after trim. Second occurrence = error for that row (e.g. "Duplicate label_id in file").
  3. **label_id uniqueness (vs DB):** No row may have a label_id that already exists for the current organization. Otherwise error "Label ID already exists."
  4. **asset_type:** Must resolve to exactly one AssetType in the org.
  5. **client:** If non-empty, must resolve to exactly one Client in the org.
  6. **warehouse:** If non-empty, must resolve to exactly one Warehouse in the org.
  7. **zone:** If non-empty, warehouse must be non-empty and zone must resolve to exactly one Zone that belongs to the resolved warehouse.
  8. **status:** Must be one of the four allowed values (after normalization if defined).
  9. **notes:** If present, length within limit.

Validation is **per row**. Each row produces either "valid" or one or more error messages. Do not short-circuit the file on first error; validate all rows (or validate in batches) so the response can report all errors.

### 1.5 How partial failures are handled

**Strategy: per-row processing with full error report.**

- **Validate** every row and classify as valid or invalid (with error messages).
- **Insert** only rows that passed validation. Inserts can be done in one transaction (all valid rows) or in a single transaction per batch for very large files; document the choice. Invalid rows are never inserted.
- **Response:** Always return a structured result:
  - **total_rows:** Number of data rows (excluding header).
  - **imported:** Number of rows successfully inserted.
  - **failed:** Number of rows that had validation errors and were not inserted.
  - **errors:** List of error entries, one per failed row. Each entry includes at least: **row** (1-based row number in file, or 2 if header is row 1), **label_id** (value from the row, for identification), **message** (single string or list of messages). Optionally include **column** if the error is field-specific.

**Behavior:**

- If **every** row fails validation: return 200 (or 422) with imported = 0, failed = total_rows, and full errors list. Do not create any assets.
- If **some** rows fail: insert only valid rows; return 200 with imported = N, failed = M, and errors only for the M failed rows. Client can fix and re-import the failed rows (e.g. in a new file).
- If **all** rows are valid: insert all; return 200 with imported = total_rows, failed = 0, errors = [] (or omit errors).
- **Whole-file rejection:** Reject the entire request (e.g. 413 or 422) without inserting anything when: file exceeds max size, row count exceeds limit, header is missing or invalid (no recognizable required columns), or file is not valid CSV/UTF-8. Return a single message (e.g. "File too large" or "Invalid header: missing 'label_id'").

**No "fail whole file on first row error"** in normal processing; only reject whole file for structural/size issues.

### 1.6 How duplicates (label_id) are handled

- **Duplicate within the same file:** If two or more rows have the same label_id (after trim), treat **all but the first** as failed. Error message: e.g. "Duplicate label_id in file." Optionally fail the first occurrence too and report duplicate for both; recommended: fail only the subsequent rows so that if the user fixes duplicates and re-imports, the first occurrence can succeed.
- **Duplicate vs existing database:** If a row’s label_id already exists for the current organization, that row fails. Error message: e.g. "Label ID already exists." Do not update the existing asset; import does not support upsert.

### 1.7 Whether AssetHistory is written on import

**No.** For MVP, do not write AssetHistory rows for assets created via CSV import.

Rationale: Bulk import is for initial load or large additions; writing one history row per asset would multiply table size and is not required for dispute resolution (import is not an "update" by a user in the same sense as the edit screen). If you later need to record "imported on date by user," that can be a single log or a separate audit concept; for MVP, keep import without AssetHistory.

### 1.8 Expected response after import

**Success (at least one row imported):** HTTP 200. Body (e.g. JSON):

- **total_rows:** integer  
- **imported:** integer  
- **failed:** integer  
- **errors:** array of { **row:** integer, **label_id:** string, **message:** string (or array of strings) }

**All rows failed or whole-file rejection:** HTTP 422 (or 200 with imported = 0). For whole-file rejection, body can be a single **message** (e.g. "Invalid header" or "File exceeds maximum size"). For "all rows failed," same structure as above with imported = 0 and errors populated.

**Auth/forbidden:** 401 or 403 per auth rules. **Server error:** 500 with generic message.

---

## 2. CSV EXPORT

### 2.1 What data can be exported

- **Entity:** Assets only. Current state of each asset (one row per asset).
- **Scope:** Only assets belonging to the current user’s organization. No assets from other organizations.
- **Deleted assets:** Not applicable. Assets are hard-deleted when allowed (no history); once deleted, they are not in the DB and therefore never appear in export. No "include deleted" option in MVP.
- **History:** Export does **not** include AssetHistory. Each row is the current snapshot of the asset only. No "export history" or "audit trail export" in MVP.

### 2.2 Which columns are included

Export columns are human-readable (names, not raw IDs). Suggested set:

| Column (header) | Source | Format |
|----------------|--------|--------|
| Label ID | asset.label_id | As stored. |
| Asset Type | AssetType.name (or code) for asset.asset_type_id | Resolved name (or code). |
| Owner | "Company" if client_id is null; else Client.name | String. |
| Warehouse | Warehouse.name (or code) for asset.warehouse_id; empty if null | String or empty. |
| Zone | Zone.name (or code) for asset.zone_id; empty if null | String or empty. |
| Status | asset.status | Exact value: in_use, idle, damaged, lost. |
| Notes | asset.notes | As stored; empty if null. |
| Last Updated | asset.updated_at | Formatted per 2.5. |

**Column order:** Use a fixed order (e.g. Label ID, Asset Type, Owner, Warehouse, Zone, Status, Notes, Last Updated). Header row is the first line of the CSV.

**Empty values:** Use empty string for null optional fields (client, warehouse, zone, notes). Do not export the word "null" or similar.

### 2.3 How filters are applied

- Export respects the same filters as the Reports screen (and the same as any "export from list" action):
  - **Date range (last updated):** Optional. If provided: asset.updated_at >= from_date and asset.updated_at <= to_date (inclusive; define time component, e.g. start/end of day in org timezone or UTC).
  - **Asset type:** Optional. If provided: asset.asset_type_id in selected type(s) or single type. Only types in current org.
  - **Status:** Optional. If provided: asset.status in selected value(s). One or more of in_use, idle, damaged, lost.
  - **Owner:** Optional. If "company-owned": client_id is null. If "client-owned" or a specific client: client_id = selected client id (org-scoped).
  - **Warehouse:** Optional. asset.warehouse_id = selected warehouse (org-scoped).
  - **Zone:** Optional. asset.zone_id = selected zone (org-scoped; zone implies warehouse).

- All filters are optional. When no filters are applied, export includes all assets in the organization (subject to row limit if any).
- Filters are applied server-side using the current user’s organization_id. No filter parameter may reference another organization.

### 2.4 File naming conventions

- **Pattern:** Fixed, predictable. Example: `assets_export_YYYY-MM-DD.csv` (e.g. `assets_export_2025-02-03.csv`) using the **date of the export request** (server date), not the filter date range.
- Alternative: include org identifier if useful for support (e.g. `assets_export_{org_id_or_slug}_2025-02-03.csv`). Define one convention and stick to it.
- **Extension:** `.csv`.
- **Content-Disposition:** Server should set response header so the browser downloads the file with this name (e.g. `Content-Disposition: attachment; filename="assets_export_2025-02-03.csv"`). Use ASCII filename or RFC 5987 for non-ASCII.

### 2.5 Date/time formatting rules

- **Last Updated column:** Format asset.updated_at in a single, consistent way. Options:
  - **ISO 8601:** e.g. `2025-02-03T14:30:00Z` (UTC) or with offset. Good for re-import or machine readability.
  - **Date only:** e.g. `2025-02-03` if time is not needed for reports.
  - **Locale-friendly:** e.g. `02/03/2025 2:30 PM` in a fixed format.

Pick one for MVP (e.g. ISO 8601 in UTC) and document it. Same format for every export.

- **CSV structure:** UTF-8 encoding; comma delimiter; header row; quote fields that contain comma, newline, or double-quote. Same quoting rules as import for consistency.

### 2.6 Deleted assets and history

- **Deleted assets:** Not included. Only current assets (rows in Asset table) are exported. Deleted assets are no longer in the DB.
- **History:** Not included. Export is a snapshot of current state only. No column or separate file for AssetHistory in MVP.

---

## 3. Guardrails

### 3.1 Organization scoping

- **Import:** Every created asset must have organization_id = current user’s organization_id. All resolution (asset type, client, warehouse, zone) uses only entities belonging to that organization. Reject or ignore any row that would require data from another org (e.g. if a column referred to another org—not possible if resolution is strictly org-scoped).
- **Export:** Query only assets (and related AssetType, Client, Warehouse, Zone) where organization_id = current user’s organization_id. Filter parameters (e.g. warehouse_id, client_id) must be validated to belong to the current org before use in the query.

### 3.2 Permissions (Admin vs User)

- **Import:** Both Admin and User may import. Same permission as "Create asset." No Admin-only restriction.
- **Export:** Both Admin and User may export. Same as Reports screen. No Admin-only restriction.

### 3.3 Maximum file size and row limits

**Import:**

- **Max file size:** Define a limit (e.g. 5 MB or 10 MB). Reject the request with 413 Payload Too Large (or 422 with message "File too large") if exceeded. Do not process the file.
- **Max data rows:** Define a limit (e.g. 10,000 rows). If the CSV has more data rows than the limit, reject the entire file with 422 and message "Import exceeds maximum of N rows." This avoids long-running requests and abuse.

**Export:**

- **Max rows (optional):** Either no limit or a high limit (e.g. 50,000). If a limit exists and the filtered result exceeds it, return 413 or 422 with "Too many rows to export; apply more filters." Alternatively, allow export and stream the response; document the choice.

### 3.4 Validation error handling

- **Import:** Invalid rows are not inserted. Errors are collected and returned in the response body (row number, label_id, message). No partial insert of a single row (e.g. do not insert with default status if status is invalid).
- **Export:** If filter parameters are invalid (e.g. invalid warehouse id or client id for org), return 400 or 422 with a single message (e.g. "Invalid filter."). Do not return a 500 for bad filter input.
- **Encoding/format (import):** If the file cannot be parsed as UTF-8 or valid CSV, reject the whole file with 422 and a clear message. Do not guess encoding.

---

## 4. Summary

| Area | Import | Export |
|------|--------|--------|
| **Purpose** | Bulk create assets (initial setup, bulk add). | Current-state report for sharing/reporting. |
| **Data** | Rows → new Assets. No update/upsert. | Current assets only; no history, no deleted. |
| **Columns** | label_id, asset_type, status (required); client, warehouse, zone, notes (optional). Names resolved to IDs in current org. | Label ID, Asset Type, Owner, Warehouse, Zone, Status, Notes, Last Updated. |
| **Validation** | Per row; same rules as single create + within-file duplicate check. | Filters must be org-scoped and valid. |
| **Failures** | Per-row errors; insert only valid rows; return imported count + error list. Whole-file reject for size/header/encoding. | Invalid filters → 400/422. |
| **Duplicates** | Within file: fail duplicate rows. Vs DB: fail row with "already exists." | N/A. |
| **AssetHistory** | Not written on import. | Not included in file. |
| **Org / permissions** | Org from auth; both Admin and User. | Same. |
| **Limits** | Max file size and max row count; reject whole file if exceeded. | Optional max rows or stream; document. |

This is enough to implement CSV import and export in the backend without further guesswork.
