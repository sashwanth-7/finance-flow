# AGENTS.md

This repository is the LoanFlowPro finance management application.

## Project overview
- Frontend: React + Vite in `frontend/`
- Backend: Node.js + Express in `backend/`
- Database: Prisma with SQLite in `backend/prisma/`
- Domain: customer management, loan lifecycle, repayments, reports, audit logs, and agent workflows

## Working rules
- Prefer small, targeted edits that match the existing architecture and naming conventions.
- Preserve role-based behavior for `ADMIN`, `AGENT`, and `CUSTOMER` users.
- Keep backend validation and auth checks aligned with the routes in `backend/src/routes/`.
- Keep frontend state, API calls, and page patterns consistent with the current React codebase.
- If a change affects schema or business logic, inspect both the route layer and the corresponding frontend page/service before editing.

## Key directories
- `backend/src/routes/` — REST API endpoints
- `backend/src/services/` — notification and WhatsApp helpers
- `backend/src/utils/` — shared logic and calculations
- `backend/prisma/schema.prisma` — Prisma schema
- `frontend/src/pages/` — main pages
- `frontend/src/components/` — reusable UI components
- `frontend/src/services/` — API helpers

## Validation commands
Run the smallest relevant validation command:
- Backend checks: `cd backend && npm run lint` (if present) or `node --check server.js`
- Frontend checks: `cd frontend && npm run build`
- If a Prisma schema change is made, validate with Prisma tooling before finalizing.

## Notes for contributors
- Do not introduce breaking changes to the authentication flow or role permissions without checking both frontend and backend usage.
- Avoid adding test-only code to production modules.
- Respect the current mobile-ready and dashboard-oriented design patterns.
- Keep payment, audit, and loan math logic explicit and easy to review.
