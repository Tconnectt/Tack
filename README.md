# Equipment Tracker

A maintenance tracker for hospital medical equipment: what each machine is, where it is, when it was last serviced and when it is next due.

**Status:** work in progress. The backend is done; the web app comes next.

## What works now

- Sign up and sign in (the first account becomes the manager; later accounts are technicians)
- Equipment list with search and filters by status and department
- Managers add and edit equipment; technicians can view it
- Duplicate serial numbers are rejected
- Each item can have a service interval (for example every 90 days). The API works out the next due date and flags it as ok, due soon (within 14 days) or overdue
- Technicians and managers record service work: preventive, corrective, inspection or calibration, with the date, a description and any parts used. Preventive and calibration visits restart the schedule
- A service record can also change the equipment's status, in the same step
- A dashboard endpoint with totals, overdue and due-soon equipment, and recent work

## Stack

Node.js, Express 5, TypeScript, PostgreSQL, Zod. Tests use `node:test` against a real in-memory Postgres (PGlite).

## API

| Method and path | Who | What |
| --- | --- | --- |
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | anyone / signed in | Accounts |
| `GET /api/equipment?status=&department=&q=` | signed in | List with schedule status |
| `GET /api/equipment/:id` | signed in | One item |
| `POST /api/equipment`, `PATCH /api/equipment/:id` | manager | Add and edit |
| `GET /api/equipment/:id/maintenance` | signed in | Service history, newest first |
| `POST /api/equipment/:id/maintenance` | signed in | Record service work |
| `GET /api/dashboard` | signed in | Totals, overdue, due soon, recent work |

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
