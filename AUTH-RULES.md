# 3PL Asset Tracker — Authentication and Authorization Rules (MVP)

Exact rules for auth and access control. Use with the approved schema and screen behavior. No code or specific auth library—behavior and enforcement only.

---

## 1. Authentication rules

### 1.1 Login attempt

**Input:** Email + password from the client.

**Lookup:** Resolve the user by email. Because email is unique only per organization, you must either:
- Require email to be globally unique across all orgs (recommended for MVP: enforce unique email in DB or at signup), so one lookup finds the user; or
- Use an additional hint (e.g. organization slug/subdomain) so (org, email) identifies the user.

**Success when:**
- A user record exists for that identifier (email or org + email).
- Stored password hash matches the submitted password (using the same hashing algorithm and comparison method).
- `is_active` is true.

**Failure when:**
- No user found for the identifier.
- Password does not match.
- `is_active` is false.

**On success:** Issue a session token (e.g. JWT or session ID in cookie). Token must include at least: user id, organization id, role. Persist nothing user-specific server-side if using stateless JWT; if using server sessions, store user id (and optionally org id, role) in the session store.

**On failure:** Return HTTP 401 (or equivalent) and do not issue a token. Do not distinguish between "wrong password," "no such user," or "inactive" in the response body or message shown to the user.

### 1.2 Inactive users

- **At login:** If the user exists but `is_active` is false, treat as login failure. Same generic message as wrong password.
- **After login:** If an already-issued token belongs to a user who was later deactivated, the next request that validates the token must reject it (treat as unauthenticated). Optionally: when deactivating a user, invalidate their tokens (e.g. short token TTL + no server-side revocation for JWT, or delete session records for server sessions).
- **No "Account deactivated" message to the user** — use the same generic "Invalid email or password" (or "Invalid credentials") so an attacker cannot probe which emails exist or are active.

### 1.3 Session lifecycle (high-level)

- **Creation:** Session is created only on successful login (see 1.1).
- **Duration:** Define a fixed lifetime (e.g. 24 hours or 7 days). Token/session is valid until it expires or is invalidated.
- **Refresh:** MVP can use non-refreshing tokens (user logs in again after expiry) or a refresh flow; document the chosen behavior. If refresh exists, refresh must re-check that the user still exists and `is_active` is true.
- **Logout:** Client discards the token (or calls an endpoint that invalidates the server session). No server action required for stateless JWT beyond optional blocklist; for server sessions, delete or invalidate the session record.
- **Single vs multiple sessions:** MVP does not require "log out everywhere" or "one session per user"; allow multiple concurrent sessions per user unless you explicitly restrict.

---

## 2. Authorization rules

### 2.1 Role definitions

- **Admin:** Can do everything a User can do, plus: view/edit Organization settings, view User list, invite users, deactivate users.
- **User:** Can use Login, Dashboard, Assets (list/create/detail/edit), Locations (warehouses and zones), Clients, Reports. Cannot access Organization settings or User management.

### 2.2 Admin-only screens

- **Settings – Organization:** Only Admin may load the page and call any endpoint that reads or updates the organization record. User receives 403 Forbidden (or redirect to Dashboard with "You don't have access").
- **Settings – Users:** Only Admin may load the page and call any endpoint that lists users, invites a user, or deactivates a user. User receives 403 Forbidden (or redirect with message).

All other screens (Login, Dashboard, Assets, Locations, Clients, Reports) are allowed for both Admin and User.

### 2.3 Actions blocked for Users

| Action | Admin | User |
|--------|--------|------|
| View/edit organization (name, etc.) | ✓ | ✗ |
| List users | ✓ | ✗ |
| Invite user | ✓ | ✗ |
| Deactivate user | ✓ | ✗ |
| Everything else (assets, locations, clients, reports, dashboard) | ✓ | ✓ |

Enforcement: Every request that performs an Admin-only action must check that the authenticated user’s role is Admin before proceeding. If not Admin, return 403 and do not perform the action.

### 2.4 Enforcement points

- **Route/middleware:** Before entering a handler for Settings – Organization or Settings – Users (and their API equivalents), assert `role === admin`. If not, return 403.
- **Per-request:** The authenticated identity (user id, organization id, role) must be available on every request. Role is read from the token/session (or from DB once per request); do not trust client-sent role.

---

## 3. Organization scoping rules

### 3.1 Principle

Every read and write that touches tenant data must be limited to the current user’s organization. The "current organization" is the one stored with the user at login and carried in the token/session (organization_id). Never use organization id from request body, query params, or URL path to determine scope—always use the authenticated user’s organization_id.

### 3.2 Reads (list, get by id, search, reports)

- **Assets:** Filter by `organization_id = current user's organization_id`. When loading a single asset by id, verify `asset.organization_id === current user's organization_id`; if not, return 404 (not 403, to avoid leaking existence of other orgs’ data).
- **Asset types:** Same—filter and single-record check by org.
- **Clients:** Same.
- **Warehouses:** Same (warehouses have organization_id).
- **Zones:** Zones belong to warehouses; filter via warehouse’s organization_id, or join warehouse and filter by org. When loading a zone by id, ensure the zone’s warehouse belongs to the current org; otherwise 404.
- **Users (Admin only):** List and get only users where `organization_id = current user's organization_id`. Never return users from another org.
- **Organization:** Admin can read only the single organization that matches `current user's organization_id`.
- **AssetHistory:** Only for assets that belong to the current org; filter by asset’s organization_id (or by asset_id where asset is already scoped to org).

### 3.3 Writes (create, update, delete)

- **Create:** Set `organization_id` to the current user’s organization_id on every new row (Asset, AssetType, Client, Warehouse, Zone, User). Do not accept organization_id from the client; overwrite with the authenticated org.
- **Update:** Only allow update if the existing row’s organization_id matches the current user’s organization_id. For Zone, the zone’s warehouse must belong to the org. If the row is in another org, return 404.
- **Delete:** Same as update—only allow delete if the row (and, for Zone, its warehouse) belongs to the current org. Otherwise 404.
- **Invite user:** Create the new user with `organization_id = current user's organization_id`. No other org may be specified.
- **Deactivate user:** Only allow if the target user’s organization_id matches the current user’s organization_id. Otherwise 404.

### 3.4 Checks on every request

- **Required on every authenticated request that touches tenant data:** Resolve the current user and organization from the token/session. Then:
  - For reads: apply an organization filter (or a join that restricts by org).
  - For single-resource read/update/delete: after loading the resource, verify it belongs to the current org; if not, return 404.
  - For creates: set organization_id from the current user; never from input.
  - For updates/deletes: verify resource.organization_id (or equivalent via relation) equals current org before applying the change.

---

## 4. Guardrails

### 4.1 Prevent self-deactivation

- **Rule:** An Admin may not deactivate their own user account (the user id in the token/session equals the target user id).
- **Enforcement:** Before setting `is_active = false` on a user, check that target user id ≠ current user id. If equal, return 400 (or 403) with a clear message to the client (e.g. "You cannot deactivate your own account"). Do not perform the update.
- **UI:** On Settings – Users, hide or disable the "Deactivate" action for the row that represents the current user.

### 4.2 Prevent cross-org access

- **Rule:** A user must never read or modify data that belongs to another organization.
- **Enforcement:** As in section 3: always scope by current user’s organization_id. Never trust organization_id from URL, body, or query. For single-resource operations, verify resource ownership and return 404 when the resource is in another org (or missing).
- **Edge case:** If the client sends an asset id (or any tenant id) that belongs to another org, the server must not return that asset; return 404. Same for any tenant entity.

### 4.3 Prevent privilege escalation

- **Rule:** A user cannot grant themselves or others a higher privilege than their own; a User cannot turn themselves into an Admin or create an Admin.
- **Enforcement:** Only Admin can invite users or (if you add it) change roles. The "invite user" and "change role" endpoints are Admin-only (see 2.2). So a User never has a way to create or promote to Admin.
- **Invite/update role:** When an Admin invites a user or updates a role, do not allow the client to assign a role "above" the current user’s role if you later support multiple roles; for MVP there are only two roles and only Admin can set role, so no escalation path for User.
- **Token/session:** Role is stored in the token/session at login and not updatable by the client. Changing role in the DB only affects the next login (or token refresh), and only an Admin can change another user’s role (and cannot promote a User via self-service if you add "edit my profile" later—keep "role" admin-only).

---

## 5. Error-handling expectations

### 5.1 What the user sees

| Situation | HTTP status | User-visible message / behavior |
|-----------|-------------|----------------------------------|
| Login failure (bad email/password or inactive) | 401 | Single generic message, e.g. "Invalid email or password." No distinction between causes. |
| Authenticated but not authorized (User hits Admin-only screen/action) | 403 | "You don't have access to this page" or similar. Redirect to Dashboard or show error page. |
| Resource not found (wrong id or other org’s resource) | 404 | "Not found" or "This asset doesn't exist." Do not say "belongs to another organization." |
| Self-deactivation attempt | 400 or 403 | "You cannot deactivate your own account." |
| Validation error (e.g. duplicate label_id, missing required field) | 400 or 422 | Field-level or form-level message (e.g. "This label ID is already in use."). |
| Invalid or expired token / not logged in | 401 | Redirect to Login with optional "Please sign in again." |
| Server error | 500 | Generic "Something went wrong. Please try again." No stack trace or internal detail. |

### 5.2 What is logged server-side

- **Login failure:** Log at info or warning level: e.g. "Login failed for identifier [email or hash]." Do not log the password. Optionally log reason (no user / wrong password / inactive) for ops only; do not expose in API response.
- **Login success:** Optionally log "User [id] logged in" at info. Do not log password or token.
- **403 (Admin-only):** Log at warning: e.g. "User [id] attempted to access Admin-only resource [resource/action]."
- **404 on tenant resource:** Log at debug or info: e.g. "User [id] requested resource [type/id] not in org" so you can detect misuse or bugs. Do not log in a way that exposes other orgs’ ids to non-admins.
- **Self-deactivation attempt:** Log at info: "User [id] attempted to deactivate self; blocked."
- **Validation errors:** Optional; log at debug if useful for support. Do not log full request bodies that might contain PII.
- **500 errors:** Log full error and stack trace (and request id) for debugging. Do not return stack trace to the client.
- **Cross-org access attempt:** If you detect an attempt to access another org’s data (e.g. id in path/body and org mismatch), log at warning with user id and resource type; return 404 to the client.

Keep logs free of passwords, tokens, and unnecessary PII. Prefer user id over email in logs if both are available.

---

## 6. Summary

| Area | Rule |
|------|------|
| **Auth** | Login success only when user exists, password matches, and is_active. Same generic failure message for wrong password, no user, or inactive. Session carries user id, organization id, role. |
| **Admin-only** | Organization settings and User management (list, invite, deactivate). Enforce with role check before handler. |
| **Org scoping** | Every tenant read/write uses current user’s organization_id. Creates set org from auth; reads/updates/deletes verify resource belongs to org; otherwise 404. |
| **Guardrails** | No self-deactivation; no cross-org access; no privilege escalation (only Admin can invite/deactivate, role in token from server). |
| **Errors** | Generic login failure; 403 for Admin-only; 404 for wrong/missing/other-org resource; clear message for self-deactivation; generic 500. Log causes of login failure and 403/404/500 server-side without exposing to client. |

These rules are enough to implement auth and authorization for the MVP without choosing a specific auth library.
