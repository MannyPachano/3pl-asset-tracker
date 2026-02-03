# 3PL Asset Tracker — Asset Business Logic (MVP)

Exact business rules for Asset create, update, and delete, including AssetHistory. Backend only; no UI. Use with the approved schema, screen behavior, and auth rules.

**Precondition for all operations:** The acting user is authenticated and their `organization_id` is known. All operations are scoped to that organization. No operation accepts or trusts `organization_id` from the client.

---

## 1. CREATE Asset

### 1.1 Input (from client)

| Field | Required | Source | Notes |
|-------|----------|--------|-------|
| label_id | yes | client | Human-readable ID; trimmed before validation |
| asset_type_id | yes | client | Must reference AssetType belonging to current org |
| client_id | no | client | Null = company-owned. If present, must reference Client belonging to current org |
| warehouse_id | no | client | If present, must reference Warehouse belonging to current org |
| zone_id | no | client | If present, must reference Zone belonging to current org, and zone–warehouse rule must hold (see 1.3) |
| status | yes | client | One of: `in_use`, `idle`, `damaged`, `lost` |
| notes | no | client | Free text; optional length cap (e.g. 2000 chars) |

**Not accepted from client:** `id`, `organization_id`, `created_at`, `updated_at`. These are set server-side.

### 1.2 Default values (server-set)

- **organization_id:** Current user’s organization_id. Never from input.
- **created_at:** Current timestamp at insert.
- **updated_at:** Same as created_at at insert.

There are no optional server defaults for nullable columns; null is explicit when the client omits or sends null for `client_id`, `warehouse_id`, `zone_id`, `notes`.

### 1.3 Validation rules (before insert)

1. **label_id**
   - Present and non-empty after trim.
   - After trim, must be unique for the current organization: no existing Asset with same `(organization_id, label_id)`.
   - If duplicate: fail with error (see section 5).

2. **asset_type_id**
   - Present.
   - Must exist and have `organization_id = current user's organization_id`.
   - If missing or invalid: 400/422 with message that asset type is required or invalid.

3. **client_id**
   - If present: must exist and have `organization_id = current user's organization_id`.
   - If invalid: 400/422.

4. **warehouse_id**
   - If present: must exist and have `organization_id = current user's organization_id`.
   - If invalid: 400/422.

5. **zone_id and warehouse_id (pairing)**
   - If **zone_id** is present:
     - **warehouse_id** must also be present.
     - The Zone identified by `zone_id` must have `warehouse_id` equal to the provided `warehouse_id`.
     - The Zone’s warehouse must belong to the current org (already guaranteed if warehouse_id is validated above).
   - If **warehouse_id** is present and **zone_id** is present: same rule—zone must belong to that warehouse.
   - If only **warehouse_id** is present (no zone_id): valid.
   - If only **zone_id** is present (no warehouse_id): invalid—reject with error that warehouse is required when zone is set, or that zone and warehouse must match.
   - Invalid pairing: 400/422 with message e.g. "Zone does not belong to the selected warehouse."

6. **status**
   - Present and one of: `in_use`, `idle`, `damaged`, `lost`.
   - If missing or invalid: 400/422.

7. **notes**
   - Optional. If present, apply length limit; beyond limit: 400/422.

Validation order: perform all validations and return one response with all applicable errors (e.g. 422 with list), or return the first blocking error—document the chosen behavior.

### 1.4 AssetHistory on create

**MVP choice:** Optional.

- **Option A (recommended):** On successful Asset insert, insert one AssetHistory row:
  - `asset_id` = new asset’s id
  - `user_id` = current user’s id
  - `changed_at` = same timestamp as asset’s `created_at` (or current time)
  - `snapshot` = JSON of the asset’s state after create: at least `status`, `warehouse_id`, `zone_id`, `client_id`. Optional: include `asset_type_id`, `label_id` for consistency.
  - Effect: "Created" is auditable; first history row = creation state.

- **Option B:** Do not write AssetHistory on create. First history row appears after the first update. Simpler; creation is not in history.

Define which option the implementation uses. If Option A, the insert into AssetHistory must run in the same transaction as the Asset insert so that a rollback rolls back both.

---

## 2. UPDATE Asset

### 2.1 Scope and identity

- The asset to update is identified by id (path or body). The id must refer to an Asset that exists and has `organization_id = current user's organization_id`. If not (wrong id or other org): return 404. Do not perform any update.

### 2.2 Fields that can change

All of the following may be updated; the rest may not:

- asset_type_id  
- client_id  
- warehouse_id  
- zone_id  
- label_id  
- status  
- notes  

**Must not change:** `id`, `organization_id`, `created_at`.  
**Always set by server on update:** `updated_at` = current timestamp.

### 2.3 Validation rules (same as create)

Apply the same validation rules as in section 1.3, with one adjustment:

- **label_id uniqueness:** Must be unique for `(organization_id, label_id)` **excluding the current asset**. So: no other Asset in the same org may have the same label_id; the asset being updated may keep its own label_id.

All other rules are unchanged: asset_type_id and (if present) client_id, warehouse_id, zone_id must belong to the org; zone–warehouse pairing must hold when both are present; status must be one of the four values; notes length if limited.

### 2.4 When AssetHistory is written

- **Trigger:** On every successful update of the Asset row.
- **Rule:** One update → one new AssetHistory row. Do not skip history if "only notes changed" or "only asset_type_id changed"; every update produces one history row so the audit trail is consistent and simple.

### 2.5 Contents of the AssetHistory snapshot (on update)

- **snapshot** = state of the asset **after** the update (so each row answers "what did the asset look like after this change?").
- **Minimum fields in snapshot (JSON):** `status`, `warehouse_id`, `zone_id`, `client_id`. These support "where was it, who owned it, what status" for disputes.
- **Optional:** Include `asset_type_id`, `label_id` in the snapshot for a fuller record; MVP can stay with the four fields above.

**Row contents:**

- `asset_id` = asset’s id  
- `user_id` = current user’s id  
- `changed_at` = current timestamp (same as asset’s new `updated_at`)  
- `snapshot` = JSON object with the chosen fields after the update  

Insert the AssetHistory row in the **same transaction** as the Asset update. If the update commits, the history row must commit; if the update rolls back, the history row must not be inserted (or must roll back).

### 2.6 Invalid state transitions

- There are **no** business rules that forbid a particular status change (e.g. lost → in_use is allowed). Any status can transition to any other. No extra validation for status transitions in MVP.

---

## 3. DELETE Asset

### 3.1 Whether deletion is allowed in MVP

**Yes.** Delete is an allowed operation, under the condition below.

### 3.2 Condition for delete

- **Allowed:** The asset has **no** AssetHistory rows.
- **Not allowed:** The asset has **one or more** AssetHistory rows.

Rationale: Preserve audit for any asset that was ever updated. Assets that were only created and never updated have no history and can be removed (e.g. data-entry mistake). Once an asset has been updated and history exists, it is no longer deletable so that history is never orphaned and disputes remain supported.

### 3.3 Enforcement

1. Resolve the asset by id. If not found or `organization_id ≠ current user's organization_id`: return 404.
2. Count AssetHistory rows for this asset (e.g. `WHERE asset_id = ?`). If count > 0: return 409 Conflict (or 400) with a clear message, e.g. "Cannot delete: this asset has change history." Do not delete.
3. If count = 0: delete the Asset row and return 204 (or 200 with no body). No cascade is needed because there are no history rows.

### 3.4 Alternative (not recommended for MVP)

- Allow delete even when history exists and **cascade-delete** AssetHistory rows. This simplifies delete but loses audit for that asset. Document only if you choose this; for MVP, prefer "delete only when no history."

---

## 4. Guardrails

### 4.1 Cross-org writes

- **Create:** Set `organization_id` only from the authenticated user. Never use organization_id from the request. Validate all FKs (asset_type_id, client_id, warehouse_id, zone_id) against the current org (and, for zone, against the chosen warehouse).
- **Update:** Load the asset by id; if it does not exist or `asset.organization_id ≠ current user's organization_id`, return 404 and do not update. Do not allow changing `organization_id` on the asset.
- **Delete:** Same as update—verify asset belongs to current org before checking history count or deleting. 404 if not.

No operation may create, update, or delete an asset in another organization.

### 4.2 Zone–warehouse consistency

- On create and update, if both `warehouse_id` and `zone_id` are present, reject the request unless the zone’s `warehouse_id` equals the provided `warehouse_id`. Reject with 400/422 and a clear message. Do not auto-correct or silently change warehouse_id.
- If only `zone_id` is sent without `warehouse_id`, reject (or require warehouse_id when zone_id is set). This avoids ambiguous state.

### 4.3 History consistency

- **Same transaction:** AssetHistory insert (on create if Option A, on every update) must run in the same database transaction as the Asset insert/update. Commit or roll back together.
- **Snapshot = after state:** The snapshot always reflects the asset state **after** the change. The "previous" state is the previous history row for that asset (or absence of history for "before first update").
- **No history on failed update:** If validation fails or the Asset update fails, do not insert an AssetHistory row.
- **Delete:** When delete is allowed (zero history rows), only the Asset row is deleted; no history rows exist, so no orphaned history.

---

## 5. Error cases and expected responses

| Case | HTTP status | Server behavior | User-facing message (or body) |
|------|-------------|------------------|--------------------------------|
| Duplicate label_id (create, or update to a label_id already used by another asset in same org) | 409 Conflict or 422 Unprocessable Entity | Do not insert/update. Return error body. | e.g. "An asset with this label ID already exists." |
| Invalid zone/warehouse pairing (zone not in selected warehouse, or zone without warehouse) | 400 Bad Request or 422 | Do not insert/update. Return error body. | e.g. "Zone does not belong to the selected warehouse." or "Warehouse is required when zone is set." |
| Asset not found (wrong id, or asset in another org) | 404 Not Found | Do not perform operation. Return 404. | e.g. "Asset not found." or "Not found." Do not indicate "other organization." |
| Cross-org access attempt (e.g. client sends another org’s asset id on update/delete) | 404 Not Found | Treat as not found. Same as above. | Same as above. |
| Delete when asset has one or more AssetHistory rows | 409 Conflict or 400 | Do not delete. Return error body. | e.g. "Cannot delete: this asset has change history." |
| Invalid asset_type_id, client_id, warehouse_id, or zone_id (wrong org or missing) | 400 or 422 | Do not insert/update. Return error body. | e.g. "Invalid asset type." / "Invalid client." / "Invalid warehouse or zone." |
| Missing required field (label_id, asset_type_id, status) or invalid status value | 400 or 422 | Do not insert/update. Return error body. | Field-level or form-level message. |
| Notes exceed length limit | 400 or 422 | Do not insert/update. Return error body. | e.g. "Notes are too long." |

**Logging (server-side):** Log 404s for update/delete when asset id is valid but belongs to another org (e.g. warning with user id and asset id, no PII). Do not expose "other org" in the response. Log validation and 409/422 as needed for support; avoid logging full request bodies with PII.

---

## 6. Summary

| Operation | Key rules |
|-----------|-----------|
| **Create** | organization_id from auth; label_id unique per org; FKs in org; zone belongs to warehouse when both set; status enum; optional AssetHistory row with snapshot (Option A) in same transaction. |
| **Update** | Verify asset in current org (404 otherwise); same validations as create with label_id unique excluding self; set updated_at; one AssetHistory row per update with snapshot = state after change; history insert in same transaction. |
| **Delete** | Allowed only when asset has zero AssetHistory rows; verify asset in current org (404 otherwise); 409 if history exists; no cascade of history. |
| **Guardrails** | No cross-org writes; zone–warehouse rule enforced; history in same transaction as write; snapshot = after state. |
| **Errors** | 404 for not found / other org; 409 or 422 for duplicate label_id and delete-with-history; 400/422 for validation (pairing, FKs, required, length). |

This is enough to implement Asset create, update, and delete and AssetHistory behavior in the backend without further guesswork.
