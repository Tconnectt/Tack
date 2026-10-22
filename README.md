# Equipment Tracker

A maintenance tracker for hospital medical equipment: what each machine is, where it is, when it was last serviced and when it is next due.

**Status:** work in progress. The backend foundation is done; maintenance schedules, service logs and the web app come next.

## What works now

- Sign up and sign in (the first account becomes the manager; later accounts are technicians)
- Equipment list with search and filters by status and department
- Managers add and edit equipment; technicians can view it
- Duplicate serial numbers are rejected

## Stack

Node.js, Express 5, TypeScript, PostgreSQL, Zod. Tests use `node:test` against a real in-memory Postgres (PGlite).

## Run the backend

```bash
cd backend
npm install
cp .env.example .env.local   # add DATABASE_URL and JWT_SECRET
npm run migrate
npm run dev
npm test
```

All data used while building is made up. Do not enter real patient information.
