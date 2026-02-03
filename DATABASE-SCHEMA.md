# 3PL Asset Tracker — Database Schema (MVP)

Implementation-ready schema. Generic types (string, integer, boolean, timestamp, etc.); no ORM or SQL. One organization per account; all tenant data scoped by `organization_id` where applicable.

---

## 1. Tables and columns

### Organization

| Column       | Type      | Required | Notes                          |
|-------------|-----------|----------|--------------------------------|
| id          | integer   | yes      | Primary key                    |
| name        | string    | yes      | Organization display name      |
| created_at  | timestamp | yes      |                                |
| updated_at  | timestamp | yes      |                                |

**Primary key:** id

---

### User

| Column          | Type      | Required | Notes                                    |
|-----------------|-----------|----------|------------------------------------------|
| id              | integer   | yes      | Primary key                              |
| organization_id | integer   | yes      | Foreign key → Organization.id            |
| email           | string    | yes      | Login identifier                         |
| password_hash   | string    | yes      | Hashed password                          |
| role            | string    | yes      | Enum: `admin` \| `user`                  |
| full_name       | string    | no       | Display name (e.g. header)               |
| is_active       | boolean   | yes      | Default true; false = deactivated        |
| created_at      | timestamp | yes      |                                          |
| updated_at      | timestamp | yes      |                                          |

**Primary key:** id  
**Foreign keys:** organization_id → Organization.id  
**Uniqueness:** (organization_id, email) — one email per org.

---

### AssetType

| Column          | Type      | Required | Notes                          |
|-----------------|-----------|----------|--------------------------------|
| id              | integer   | yes      | Primary key                    |
| organization_id | integer   | yes      | Foreign key → Organization.id  |
| name            | string    | yes      | e.g. "Pallet", "Tote"          |
| code            | string    | no       | Short code e.g. "PLT"          |
| created_at      | timestamp | yes      |                                |
| updated_at      | timestamp | yes      |                                |

**Primary key:** id  
**Foreign keys:** organization_id → Organization.id  

No uniqueness constraint on name/code for MVP; org can have duplicate names if desired.

---

### Client

| Column          | Type      | Required | Notes                         |
|-----------------|-----------|----------|-------------------------------|
| id              | integer   | yes      | Primary key                   |
| organization_id | integer   | yes      | Foreign key → Organization.id |
| name            | string    | yes      | e.g. "Acme Corp"              |
| created_at      | timestamp | yes      |                               |
| updated_at      | timestamp | yes      |                               |

**Primary key:** id  
**Foreign keys:** organization_id → Organization.id  

Used only to mark asset ownership; null client on asset = company-owned.

---

### Warehouse

| Column          | Type      | Required | Notes                         |
|-----------------|-----------|----------|-------------------------------|
| id              | integer   | yes      | Primary key                   |
| organization_id | integer   | yes      | Foreign key → Organization.id |
| name            | string    | yes      | e.g. "DC-East", "WH-1"        |
| code            | string    | no       | Optional short code           |
| created_at      | timestamp | yes      |                               |
| updated_at      | timestamp | yes      |                               |

**Primary key:** id  
**Foreign keys:** organization_id → Organization.id  

---

### Zone

| Column        | Type      | Required | Notes                        |
|---------------|-----------|----------|------------------------------|
| id            | integer   | yes      | Primary key                  |
| warehouse_id  | integer   | yes      | Foreign key → Warehouse.id   |
| name          | string    | yes      | e.g. "Receiving", "A-01"     |
| code          | string    | no       | Optional short code          |
| created_at    | timestamp | yes      |                              |
| updated_at    | timestamp | yes      |                              |

**Primary key:** id  
**Foreign keys:** warehouse_id → Warehouse.id  

Location = Warehouse + Zone. Zone belongs to one warehouse; no organization_id (reached via Warehouse).

---

### Asset

| Column          | Type      | Required | Notes                                      |
|-----------------|-----------|----------|--------------------------------------------|
| id              | integer   | yes      | Primary key                                |
| organization_id | integer   | yes      | Foreign key → Organization.id              |
| asset_type_id   | integer   | yes      | Foreign key → AssetType.id                 |
| client_id       | integer   | no       | Foreign key → Client.id; null = company-owned |
| warehouse_id    | integer   | no       | Foreign key → Warehouse.id                 |
| zone_id         | integer   | no       | Foreign key → Zone.id                      |
| label_id        | string    | yes      | Human-readable ID e.g. "PLT-001"           |
| status          | string    | yes      | Enum: `in_use` \| `idle` \| `damaged` \| `lost` |
| notes           | string    | no       | Free text                                  |
| created_at      | timestamp | yes      |                                            |
| updated_at      | timestamp | yes      |                                            |

**Primary key:** id  
**Foreign keys:**  
- organization_id → Organization.id  
- asset_type_id → AssetType.id  
- client_id → Client.id (nullable)  
- warehouse_id → Warehouse.id (nullable)  
- zone_id → Zone.id (nullable)  

**Uniqueness:** (organization_id, label_id) — label must be unique per org.

**Constraint (application or DB):** When both warehouse_id and zone_id are set, zone must belong to that warehouse (zone.warehouse_id = asset.warehouse_id).

---

### AssetHistory (audit)

| Column     | Type      | Required | Notes                                      |
|------------|-----------|----------|--------------------------------------------|
| id         | integer   | yes      | Primary key                                |
| asset_id   | integer   | yes      | Foreign key → Asset.id                     |
| user_id    | integer   | yes      | Foreign key → User.id (who made the change)|
| changed_at | timestamp | yes      | When the change was saved                  |
| snapshot   | json      | yes      | Asset state after this change (e.g. status, warehouse_id, zone_id, client_id) |

**Primary key:** id  
**Foreign keys:** asset_id → Asset.id, user_id → User.id  

**Behavior:** On each update to an asset (location, status, owner, notes), insert one row: who, when, and the new state in `snapshot`. Enables “what changed when” and dispute support without storing full field-level diff. No history on create (optional: one row with snapshot for “created”).

**Delete policy:** Prevent deleting an asset that has history (FK RESTRICT), or cascade delete history with the asset; RESTRICT is recommended so audit is kept.

---

## 2. Relationships (summary)

| From       | To         | Relationship   | FK column(s)     |
|------------|------------|----------------|------------------|
| User       | Organization | Many → One   | organization_id  |
| AssetType  | Organization | Many → One   | organization_id  |
| Client     | Organization | Many → One   | organization_id  |
| Warehouse  | Organization | Many → One   | organization_id  |
| Zone       | Warehouse  | Many → One     | warehouse_id     |
| Asset      | Organization | Many → One   | organization_id  |
| Asset      | AssetType  | Many → One     | asset_type_id    |
| Asset      | Client     | Many → One     | client_id (opt)  |
| Asset      | Warehouse  | Many → One     | warehouse_id (opt) |
| Asset      | Zone       | Many → One     | zone_id (opt)    |
| AssetHistory | Asset     | Many → One     | asset_id         |
| AssetHistory | User      | Many → One     | user_id          |

**Organization** is the top-level tenant: Users, AssetTypes, Clients, Warehouses, and Assets all belong to one organization. Zones belong to Warehouses.

---

## 3. AssetHistory: why included and how

**Decision:** Include a minimal **AssetHistory** table.

**Reason:** The product is meant to support “where is it, who owns it, what’s the status” and to help settle disputes. A minimal audit (who changed what, when, and the resulting state) supports that without building full field-level history or event sourcing.

**Handled in app:** On every asset update (location, status, client_id, notes), after saving the asset, insert one AssetHistory row with current user, timestamp, and a snapshot of the fields that matter (e.g. status, warehouse_id, zone_id, client_id). No need to store old value or field name; the previous state is the previous row’s snapshot for that asset.

**If AssetHistory were excluded:** Auditing would be “current state only” plus exports. No “who changed it when.” Disputes would rely on exports and app/server logs, which are weaker and not queryable in-app. For a small table and simple write-on-update logic, including it is justified for MVP.

---

## 4. Out of scope (no tables)

- Billing, subscriptions, invoices, plans  
- Integrations, API keys, webhooks  
- Invite tokens (use signed/JWT invite links and set password in-app; no invite table)  
- Sessions (use stateless auth e.g. JWT; no session table required)  
- Soft-deletes on Asset, Client, Warehouse, Zone, AssetType (hard delete allowed; User uses `is_active` only)  
- Future entities (e.g. contacts, documents, multi-org)

---

## 5. Enums (reference)

- **User.role:** `admin` \| `user`  
- **Asset.status:** `in_use` \| `idle` \| `damaged` \| `lost`  

Store as strings; enforce in application or via DB enum/check as needed.
