# Restaurant POS

Point-of-sale web app for a single restaurant: tables, orders, kitchen, payments (USD + KHR), shifts, reports.
Khmer UI. Built one phase at a time.

**Status:** Phase 0 (setup), Phase 1 (money module), Phase 2 (staff, PIN login, roles, audit log) are done.

## Requirements
- Node.js 22 (`.nvmrc`)
- PostgreSQL 16 or newer. Install it directly (Windows installer) **or** use Docker (`npm run db:up`).

## First-time setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill it in:
   - `DATABASE_URL` must match your database user, password and name.
   - `PIN_SECRET`: make your own with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
     Keep it private. If you ever change it, every PIN stops working and must be reset.
   - `INITIAL_ADMIN_NAME` and `INITIAL_ADMIN_PIN` (exactly 6 digits, not like 123456).
3. Create the database user and database (only needed with a direct PostgreSQL install; Docker does it for you).
   In "SQL Shell (psql)" as the `postgres` user:
   ```sql
   CREATE USER pos WITH PASSWORD 'your-password' CREATEDB;
   CREATE DATABASE pos OWNER pos;
   ```
4. Create the tables. The audit log must be made append-only, which needs one extra step:
   ```bash
   npx prisma migrate dev --create-only --name staff_auth_audit
   ```
   Open the newly created `prisma/migrations/<date>_staff_auth_audit/migration.sql`, and paste the whole content of
   `prisma/sql/audit-log-append-only.sql` at the **end** of it. Save. Then:
   ```bash
   npm run db:migrate
   npm run db:generate
   ```
5. `npm run staff:create-admin` creates the first Admin. Then **delete `INITIAL_ADMIN_PIN` from `.env`**.
6. `npm run dev`, open http://localhost:3000 and log in. Change the Admin PIN on the home screen.

Health check: http://localhost:3000/api/health should show `{"ok":true}`.

## Everyday commands
| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development |
| `npm test` | Unit tests (money, PIN rules, roles, lockout, ...) |
| `npm run lint` / `npm run typecheck` | Code and type checks |
| `npm run build` | Production build |
| `npm run staff:create-admin` | Create the first Admin (does nothing if one exists) |
| `npm run db:studio` | Browse the database in the browser |

## Optional: integration tests (real database)
These test login, lockout, permissions and the audit log against a real PostgreSQL. They are skipped unless you set up a **separate** test database (the name must end in `_test`, because the tests write data):
```sql
CREATE DATABASE pos_test OWNER pos;
```
```powershell
$env:DATABASE_URL="postgresql://pos:your-password@localhost:5432/pos_test"; npx prisma migrate deploy
$env:TEST_DATABASE_URL="postgresql://pos:your-password@localhost:5432/pos_test"; npm test
```
(Remember the audit trigger step from the setup: it is part of the migration, so `migrate deploy` applies it.)

## Rules that never change
- Money is always a whole number: USD in cents, KHR in riel. Percentages are basis points (1000 = 10%).
- All money math lives in `src/lib/money` and has unit tests. Never calculate money anywhere else.
- Completed sales are never edited or deleted. Mistakes are fixed with void/refund records and the audit log.
- Every API route calls `requireStaff(...)` first. Pages use `requirePageStaff(...)`. Permissions live in `src/server/auth/permissions.ts`.
- PINs are hashed (Argon2id + `PIN_SECRET`). PINs, hashes and session tokens never go into logs or the audit log.
- Secrets live in `.env` only. `.env` is never committed.
- Screen text lives in `src/messages/km.json`, never inside components.
- Production must run over HTTPS (the login cookie is marked Secure).
