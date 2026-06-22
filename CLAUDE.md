# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Aiqda is a full-stack MERN platform (Node.js/Express/Mongoose backend, React 19/Vite/Zustand/Tailwind/Framer Motion frontend). It serves a skill/learning platform with subscriptions (Tap payments), Vimeo video lessons, quizzes, consultations, and instructor/studio application workflows.

`AGENTS.md` and `replit.md` contain additional product/feature history — consult them for the full feature changelog. This file focuses on architecture and conventions that aren't obvious from a single file.

## Commands

Root (`/`):
```bash
npm run install:all     # install backend + frontend deps
npm run start           # run backend (serves built frontend from frontend/dist)
npm run build           # build frontend
npm run test:backend    # backend test suite
npm run verify          # test:backend + frontend build (use before declaring done)
```

Backend (`/backend`):
```bash
npm run dev             # node --watch src/server.js
npm test                # NODE_ENV=test node --test --test-concurrency=1 tests/*.test.js
npm run seed:demo       # seed demo data (src/seed.js)
npm run seed:consultations
node --test tests/auth-and-users.test.js   # run a single test file
```

Frontend (`/frontend`):
```bash
npm run dev             # vite on port 5000, proxies /api and /uploads to localhost:3001
npm run build
```

Local ports: backend `3001`, frontend `5000`, MongoDB `mongodb://localhost:27017/aiqda`.

## Testing

- Uses the **Node.js built-in test runner** (`node:test`), not Jest/Mocha. Tests are integration-style with `supertest` against the real Express app.
- **Tests require a running MongoDB.** Each suite spins up a uniquely-named throwaway database (`aiqda_test_<uuid>`) via `tests/helpers/integration.js` → `setupIntegrationSuite()`. Override the server with `TEST_MONGODB_URI`.
- Tests run serially (`--test-concurrency=1`) because they share the rate-limit store and DB connection. Keep new tests using the shared helper.

## Backend Architecture

**Modular structure.** Each domain lives in `backend/src/modules/<name>/` with a consistent 4-file pattern:
`*.model.js` (Mongoose schema) · `*.service.js` (DB/business logic) · `*.controller.js` (req/res) · `*.routes.js` (Express router). Routes are mounted in `src/app.js` under `/api/<name>`.

**Entry flow:** `server.js` connects to Mongo, then runs a sequence of idempotent startup tasks before `app.listen` — see `src/startup/`:
- `validateRuntimeConfig` — fails fast on bad config
- `autoSeedIfEmpty` (`src/seed.js`) — seeds demo data + default admin (`admin@aiqda.com` / `admin123`) only when the DB has no users
- `syncSubscriptionPackageRoadmap`, `backfillLegacyLessonPublishState` — data migrations that run every boot
- `ensureSystemUsers` — guarantees the application-reviewer account exists
- `startSubscriptionRenewalWorker` — interval worker that charges saved Tap cards for renewals

When changing schemas, check whether a startup migration in `src/startup/` needs to be added/updated to backfill existing data.

**Auth & sessions** (`src/middlewares/auth.middleware.js`):
- JWT is sent via **httpOnly cookie** (see `utils/authCookie.js`), not an Authorization header. Frontend uses `withCredentials: true`.
- Beyond verifying the JWT, `authenticate` also validates an active session record on the user (`validateAuthenticatedSessionForUser`) — a valid token alone is not enough.
- Middleware exports: `authenticate`, `authenticateOptional`, `authorize(...roles)`, and the convenience guards `isAdmin`, `isInstructor`, `isStudent`, `canReviewApplications`. `requirePlatformNoticeAcknowledgement` gates users who haven't accepted the current platform notice.

**Roles** (`src/utils/roles.js`): DB roles are `student`, `instructor`, `admin`, `applications_admin`. Note `applications_admin` is a back-office role that can review applications but is not a full admin — use the role-group constants (`INSTRUCTOR_ACCESS_ROLES`, `APPLICATION_REVIEW_ROLES`, etc.) rather than hardcoding role strings.

**Config as code** (`src/config/`): `platformNotice.js` (versioned notice users must accept), `creatorTerms.js`, `refundPolicy.js`. Bumping `PLATFORM_NOTICE_VERSION` forces all users to re-acknowledge.

## Frontend Architecture

- **Single API layer**: `frontend/src/services/api.js` — one axios instance with `withCredentials`, grouped per-domain export objects (`authAPI`, `usersAPI`, etc.). A response interceptor redirects to `/login` on 401 (except for auth routes). FormData requests auto-strip the JSON content-type. Add new endpoints here, not inline in components.
- **State**: Zustand stores in `src/store/` — `authStore.js` (hydrates the user via `authAPI.getProfile()` on load, mirrors role helpers) and `uiStore.js`.
- **Routing/role gating** in `src/App.jsx`; role helpers in `src/utils/roles.js` mirror the backend role groups.
- Frontend mirrors the platform-notice version (`src/content/platformNotice.js`) — keep it in sync with the backend config when bumping.

## Critical Domain Terminology

Frontend display names differ from backend/DB names. **Do not rename backend fields/routes/DB collections** to match UI labels unless a task explicitly requires a schema/API change:

| UI term     | Backend/DB |
|-------------|------------|
| Chapter     | course     |
| Content     | lesson     |
| Creator     | instructor |
| Member      | student    |
| Achievement | certificate|

## Working Notes

- Most product features span backend + frontend — verify both sides when changing a feature.
- Payment/subscription changes: trace the Tap checkout flow, the webhook activation path, and the renewal worker together.
- The built frontend (`frontend/dist`) is served by Express in production; SPA fallback in `app.js` excludes `/api/` and `/uploads/`.
- CORS, CSP (helmet), and `trust proxy` are configured in `app.js` — Tap and Vimeo origins are explicitly allowlisted in the CSP. Update those lists when adding external script/frame sources.
- See `AGENTS.md` for the full environment variable list and `DEPLOYMENT.md` for deployment.
