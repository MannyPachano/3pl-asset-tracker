# Onboarding guide

This doc describes how to onboard two different kinds of “clients” in 3PL Asset Tracker.

---

## 1. Onboarding a new 3PL company (new tenant)

When a **new company** (a new 3PL) starts using the software, they need their own **Organization** and at least one **Admin** user. The app does **not** have a public “Sign up” page. You create the tenant manually.

### Steps

1. **Create the organization and first admin**  
   Use one of these options:

   - **Seed script (dev/demo):**  
     Edit `prisma/seed.ts` (org name, admin email, password), then run:
     ```bash
     npm run db:seed
     ```
   - **Production:**  
     Create the organization and user in the database (e.g. via Prisma Studio, a one-off script, or SQL), then set a password for the user (or use the invite flow below to send a set-password link).

2. **Give the admin access**  
   - Send them the **login URL** (e.g. `https://your-app.com/login`).  
   - Send **temporary credentials** (if you set a password in the seed/script), **or**  
   - As an existing Admin, log in → **Settings** → **Users** → **Invite user** with their email and role **Admin**, then send them the **Set password** link the app shows (they use it once to set their password and can then log in).

3. **They complete setup**  
   The new admin logs in and can:
   - Change their password if they used the set-password link.
   - Edit **Settings** → **Organization** (e.g. company name).
   - Add **Locations** (warehouses and zones).
   - Add **Asset types** and **Clients** (their customers).
   - Add **Assets** and invite more **Users** from **Settings** → **Users**.

---

## 2. Onboarding a new Client (customer of the 3PL)

When the 3PL wants to track assets **owned by a new customer** (e.g. “Acme Corp”), that customer is a **Client** in the app. Clients do **not** log in; they are just a name used for “client-owned” assets.

### Steps

1. **Log in** as any User or Admin.
2. Go to **Clients** in the nav.
3. Click **Add client**.
4. Enter the **name** (e.g. “Acme Corp”), optional **code** if you use it, then **Save**.
5. When creating or editing **Assets**, choose **Client-owned** and select this client as the owner.

That’s it. No invite or password; the Client is just a lookup so you can assign and filter assets by owner.

---

## Summary

| Who you’re onboarding | What to do |
|------------------------|------------|
| **New 3PL company (new tenant)** | Create Organization + first Admin (seed or DB/script). Give them login URL and credentials or a set-password link. They then configure org, locations, asset types, and clients in the app. |
| **New Client (customer of the 3PL)** | In the app: **Clients** → **Add client** → enter name → Save. Use that client when creating/editing assets as “client-owned”. |
