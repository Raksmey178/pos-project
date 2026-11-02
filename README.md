# Restaurant POS

Point-of-sale web app for a single restaurant: tables, orders, kitchen, payments (USD + KHR), shifts, reports.
Khmer UI. Built one phase at a time (see the plan in the chat that created this project).

**Status:** Phase 0 (setup) and Phase 1 (money module) are done.

## Requirements
- Node.js 22 (`.nvmrc`)
- Docker (for the local PostgreSQL database)

## First-time setup
```bash
npm install
cp .env.example .env        # then edit .env and change the password in BOTH places
npm run db:up               # starts PostgreSQL in Docker
npm run db:generate         # creates the Prisma client in src/generated
npm run db:migrate          # creates the tables (name the migration "init")
npm run dev                 # http://localhost:3000
```
Check the database connection: open http://localhost:3000/api/health. It should show `{"ok":true}`.

## Everyday commands
| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development |
| `npm test` | Run the unit tests (money module) |
| `npm run lint` | Check code style problems |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Production build |
| `npm run db:studio` | Browse the database in the browser |

## Rules that never change
- Money is always a whole number: USD in cents, KHR in riel. Percentages are basis points (1000 = 10%).
- All money math lives in `src/lib/money` and has unit tests. Never calculate money anywhere else.
- Completed sales are never edited or deleted. Mistakes are fixed with void/refund records and the audit log.
- Every API route checks permissions on the server (from Phase 2 on).
- Secrets live in `.env` only. `.env` is never committed.
- Screen text lives in `src/messages/km.json`, never inside components.
