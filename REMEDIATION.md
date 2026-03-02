# NDECCSchedApp — Complete Remediation Plan

**Generated:** 2026-02-27
**Audited Against:** Modern Software Development Practices (2025-2026) + Global CLAUDE.md Standards

---

## Overview

This document is the single source of truth for bringing NDECCSchedApp to production-grade quality. Each phase is ordered by priority — later phases depend on earlier ones. The assessment scored the project **3.8/10 for production readiness**, with strong foundations in security and backend architecture but critical gaps in type safety, testing, CI/CD, and observability.

| Phase                                                    | Focus                         | Severity | Est. Effort | Status      |
| -------------------------------------------------------- | ----------------------------- | -------- | ----------- | ----------- |
| [Phase 1](#phase-1-critical-security-fixes)              | Security Fixes                | Critical | 1-2 days    | ✅ COMPLETE |
| [Phase 2](#phase-2-backend-architecture-fixes)           | Backend Architecture          | Critical | 3-4 days    | ✅ COMPLETE |
| [Phase 3](#phase-3-developer-tooling--cicd)              | Developer Tooling & CI/CD     | Critical | 2-3 days    | ✅ COMPLETE |
| [Phase 4](#phase-4-database--observability)              | Database & Observability      | High     | 3-4 days    | Pending     |
| [Phase 5](#phase-5-typescript-migration)                 | TypeScript Migration          | High     | 5-7 days    | Pending     |
| [Phase 6](#phase-6-api-documentation--backend-hardening) | API Docs & Backend Hardening  | High     | 3-4 days    | Pending     |
| [Phase 7](#phase-7-frontend-modernization)               | Frontend Modernization        | High     | 5-7 days    | Pending     |
| [Phase 8](#phase-8-design-system--accessibility)         | Design System & Accessibility | Medium   | 3-4 days    | Pending     |
| [Phase 9](#phase-9-comprehensive-testing)                | Comprehensive Testing         | High     | 4-5 days    | Pending     |
| [Phase 10](#phase-10-performance--scalability)           | Performance & Scalability     | Medium   | 2-3 days    | Pending     |

**Total estimated effort:** ~32-43 developer-days (~6-8 weeks)
**Completed:** Phase 1 + 2 + 3 (~7-9 days)
**Remaining:** ~25-34 developer-days (~5-6 weeks)

---

## How to Use This Document

1. **Work sequentially** — Phase 3 before 4, 4 before 5, etc. Dependencies exist.
2. **Each task has a complexity rating** — Small (<1hr), Medium (1-4hrs), Large (4-8hrs+)
3. **Check off tasks as you go** — Change `[ ]` to `[x]` when done
4. **Don't skip phases** — Even "Medium" severity phases have production implications
5. **Each phase ends with a validation checklist** — Verify before moving on

---

# Phase 1: Critical Security Fixes ✅ COMPLETE

**Summary:** Added JWT auth with HttpOnly cookies, locked down CORS, added Helmet security headers, rate limiting (300 req/15min global + 30 req/min HubSpot), secrets management via `.env`, input sanitization with Joi, and error message leak prevention.

**Tasks completed:** 10/10

- [x] 1.1 — Authentication middleware (JWT + HttpOnly cookies)
- [x] 1.2 — CORS lockdown (allowlist-based)
- [x] 1.3 — Helmet security headers
- [x] 1.4 — Rate limiting (global + per-route)
- [x] 1.5 — Production env var validation (fail-fast)
- [x] 1.6 — Removed `window.__API_BASE__` XSS vector
- [x] 1.7 — Sanitized `traineeName` input
- [x] 1.8 — Protected HubSpot endpoints
- [x] 1.9 — Stopped leaking error messages
- [x] 1.10 — Added `*.db` to `.gitignore`

---

# Phase 2: Backend Architecture Fixes ✅ COMPLETE

**Summary:** Introduced Joi schema validation on all routes, standardized API response envelope (`respond.ok/list/created`), extracted service layer (routes are now thin adapters), added global error handler with Prisma error mapping, wrapped multi-step DB ops in transactions, centralized config, and added API versioning (`/api/v1/`).

**Tasks completed:** 8/8

- [x] 2.1 — Joi input validation with `validate()` middleware
- [x] 2.2 — Standard API response envelope (`respond.js`)
- [x] 2.3 — Service layer extraction (5 services)
- [x] 2.4 — Global error handler with Prisma error codes
- [x] 2.5 — Transaction wrapping for multi-step DB ops
- [x] 2.6 — Fixed 404 on lock/unlock operations
- [x] 2.7 — Centralized config (removed redundant dotenv calls)
- [x] 2.8 — API versioning (`/api/v1/`)

---

# Phase 3: Developer Tooling & CI/CD ✅ COMPLETE

**Summary:** Added ESLint 9 flat config (backend `.mjs` for CJS compat, frontend with React plugin), Prettier with shared config + full codebase format pass, Husky pre-commit hook with lint-staged (Prettier auto-format), `.editorconfig`, and GitHub Actions CI pipeline (lint + format:check + build + test). Removed dead code (`availability.js`, empty `deploy-frontend.yml`). Fixed 4 `eqeqeq` errors, removed debug console.logs, added eslint-disable on intentional logs.

**Implementation notes:**

- Backend ESLint uses `.mjs` extension (not `.js`) because backend is CommonJS — this was a bug in the original plan.
- lint-staged runs Prettier only (not ESLint) — Windows paths with spaces break `cd backend && npx eslint` in lint-staged's shell context. ESLint is enforced by CI instead.
- Added `react/jsx-uses-vars` rule to frontend ESLint — without it, JSX component usage triggers false `no-unused-vars` warnings.

**Tasks completed:** 6/6

- [x] 3.1 — ESLint configuration (backend `eslint.config.mjs` + frontend `eslint.config.js`)
- [x] 3.2 — Prettier configuration (`.prettierrc`, `.prettierignore`, format pass)
- [x] 3.3 — Husky + lint-staged pre-commit hooks (Prettier auto-format on commit)
- [x] 3.4 — EditorConfig (`.editorconfig`)
- [x] 3.5 — GitHub Actions CI pipeline (`.github/workflows/ci.yml`)
- [x] 3.6 — Clean up dead code (`availability.js`, `deploy-frontend.yml`, `*.js.map`/`*.css.map` in `.gitignore`)

---

# Phase 4: Database & Observability

**Why now:** Before making big code changes (TypeScript, frontend overhaul), the database and monitoring foundations must be solid. You can't debug production issues with `console.log`, and SQLite/PostgreSQL behavioral differences will bite you.

**Current state:** SQLite in dev (PG in prod via Docker), no indexes beyond PKs, no cascades, no structured logging, no error tracking, no request logging.

---

## Task 4.1 — Migrate Prisma from SQLite to PostgreSQL

**Complexity: Medium** | **Files:** `prisma/schema.prisma`, `docker-compose.dev.yml`, `.env.example`, all services using `JSON.parse/stringify`

**Step 1:** Update schema provider:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Step 2:** Change `courseCodes` from manual JSON string to native JSONB:

```prisma
model Cycle {
  courseCodes Json?  // was: String?
}
```

**Step 3:** Remove all `JSON.parse(cycle.courseCodes)` / `JSON.stringify(courseCodes)` calls from:

- `services/cycleService.js` — `createCycle()`, `updateCourseCodes()`, `listCycles()`
- `services/registrationService.js` — `getRegistrationList()`

Replace with `cycle.courseCodes ?? []` (Prisma handles serialization for `Json` type).

**Step 4:** Update `.env` for local dev:

```env
DATABASE_URL=postgresql://ndecc:ndecc_dev@localhost:5432/ndecc_sched
```

**Step 5:** Regenerate migrations:

```bash
rm -rf prisma/migrations
npx prisma migrate dev --name init
```

**Validation:** `npx prisma studio` opens, all data visible, course codes stored as JSONB.

---

## Task 4.2 — Add Database Cascades

**Complexity: Small** | **Files:** `prisma/schema.prisma`

```prisma
model CycleWeek {
  cycle Cycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
}

model Booking {
  cycle   Cycle   @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  station Station @relation(fields: [stationId], references: [id], onDelete: Cascade)
}
```

**After:** Simplify `cycleService.deleteCycle()` — remove manual `deleteMany` calls for bookings/weeks. Single `prisma.cycle.delete()` cascades automatically.

**Validation:** Delete a cycle — bookings and weeks should disappear.

---

## Task 4.3 — Add Database Indexes

**Complexity: Small** | **Files:** `prisma/schema.prisma`

```prisma
model Booking {
  // existing fields...
  @@index([cycleId, shift, week])    // grid queries (most common)
  @@index([contactId])               // student info lookups
  @@index([cycleId, stationId])      // availability checks
}

model CycleWeek {
  // existing fields...
  @@index([cycleId])                 // week lookups by cycle
}
```

Run `npx prisma migrate dev --name add_indexes` after changes.

**Validation:** Run `EXPLAIN ANALYZE` on grid query — should show index scan, not sequential scan.

---

## Task 4.4 — Configure Connection Pooling

**Complexity: Small** | **Files:** `backend/src/db.js`, `.env.example`

Update `.env.example`:

```env
DATABASE_URL=postgresql://ndecc:password@localhost:5432/ndecc_sched?connection_limit=10&pool_timeout=20
```

Update `db.js` to log connection issues:

```js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

module.exports = prisma;
```

---

## Task 4.5 — Add Structured Logging (Pino)

**Complexity: Medium** | **Files:** `backend/src/logger.js` (new), `backend/src/app.js`, all services

```bash
cd backend && npm install pino pino-http
npm install -D pino-pretty  # dev only, for readable logs
```

Create `backend/src/logger.js`:

```js
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
});

module.exports = logger;
```

Add HTTP request logging in `app.js`:

```js
const pinoHttp = require('pino-http');
const logger = require('./logger');

app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
```

Replace all `console.log/error/warn` in services with `logger.info/error/warn`:

```js
const logger = require('../logger');
logger.info({ cycleId, shift }, 'Building grid');
logger.error({ err, contactId }, 'HubSpot API failed');
```

**Validation:** Start dev server — requests logged with JSON structure. HubSpot errors logged with context.

---

## Task 4.6 — Add Error Tracking (Sentry)

**Complexity: Medium** | **Files:** `backend/src/app.js`, `frontend/src/main.jsx`

**Backend:**

```bash
cd backend && npm install @sentry/node
```

In `app.js` (at the very top, before other imports):

```js
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}
```

In `errorHandler.js`, report unexpected errors:

```js
if (!err.statusCode || err.statusCode >= 500) {
  Sentry.captureException(err);
}
```

**Frontend:**

```bash
cd frontend && npm install @sentry/react
```

In `main.jsx`:

```js
import * as Sentry from '@sentry/react';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}
```

Add to `.env.example`:

```env
SENTRY_DSN=           # Optional — get from sentry.io
VITE_SENTRY_DSN=      # Optional — frontend error tracking
```

**Validation:** Trigger a 500 error — should appear in Sentry dashboard.

---

## Task 4.7 — Fix Docker Health Checks

**Complexity: Small** | **Files:** `docker-compose.dev.yml`, `docker-compose.prod.yml`

```yaml
services:
  postgres:
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ndecc -d ndecc_sched']
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://localhost:5001/api/health || exit 1']
      interval: 10s
      timeout: 5s
      retries: 3
```

**Validation:** `docker compose up` — backend waits for PG to be healthy before starting.

---

## Phase 4 Checklist

| #   | Task                         | Complexity | Status |
| --- | ---------------------------- | ---------- | ------ |
| 4.1 | Migrate to PostgreSQL        | Medium     | [ ]    |
| 4.2 | Add database cascades        | Small      | [ ]    |
| 4.3 | Add database indexes         | Small      | [ ]    |
| 4.4 | Configure connection pooling | Small      | [ ]    |
| 4.5 | Structured logging (Pino)    | Medium     | [ ]    |
| 4.6 | Error tracking (Sentry)      | Medium     | [ ]    |
| 4.7 | Fix Docker health checks     | Small      | [ ]    |

**Phase 4 Validation:** `docker compose up` starts cleanly, requests are JSON-logged, DB queries use indexes, Sentry captures a test error.

---

# Phase 5: TypeScript Migration

**Why now:** TypeScript is the single most impactful change for code quality. In 2026, plain JavaScript for a professional project is considered a legacy approach. Prisma already generates TypeScript types — you just need to use them.

**Current state:** Pure JavaScript everywhere. No type checking. No IDE autocompletion on API contracts.

**Strategy:** Backend first (smaller surface, Prisma types ready), then frontend. Incremental migration — rename files one at a time, fix errors, move on.

---

## Task 5.1 — Backend TypeScript Setup

**Complexity: Medium** | **Files:** `backend/tsconfig.json` (new), `backend/package.json`

```bash
cd backend && npm install -D typescript @types/node @types/express @types/jsonwebtoken @types/bcryptjs @types/cors @types/cookie-parser tsx
```

Create `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

Update `package.json` scripts:

```json
"dev": "tsx watch src/index.ts",
"build": "prisma generate && tsc",
"start": "node dist/index.js",
"typecheck": "tsc --noEmit"
```

Add `dist/` to `.gitignore`.

---

## Task 5.2 — Migrate Backend Core Files to TypeScript

**Complexity: Large** | **Files:** All `backend/src/*.js` → `*.ts`

**Migration order** (fewest dependencies first):

1. `config.ts` — env validation with proper types
2. `logger.ts` — typed Pino instance
3. `db.ts` — Prisma client (already typed by Prisma)
4. `lib/AppError.ts` — typed error class
5. `middleware/respond.ts` — typed response helpers
6. `middleware/validate.ts` — Joi validator with generics
7. `middleware/auth.ts` — typed request extension (`req.user`)
8. `middleware/errorHandler.ts` — typed error handler
9. `schemas/*.ts` — Joi schemas (minimal changes)
10. `services/*.ts` — business logic with Prisma types
11. `routes/*.ts` — route handlers
12. `hubspot.ts` — HubSpot service with typed responses
13. `app.ts` — Express app assembly
14. `index.ts` — entry point

**Key typing pattern for Express:**

```ts
import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  user?: { role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // ...
}
```

**Validation:** `npm run typecheck` passes with 0 errors.

---

## Task 5.3 — Frontend TypeScript Setup

**Complexity: Medium** | **Files:** `frontend/tsconfig.json` (new), `frontend/vite.config.ts`

```bash
cd frontend && npm install -D typescript @types/react @types/react-dom
```

Create `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Add script to `frontend/package.json`:

```json
"typecheck": "tsc --noEmit"
```

---

## Task 5.4 — Create Frontend Type Definitions

**Complexity: Medium** | **Files:** `frontend/src/types/index.ts` (new)

```ts
// Domain types — derived from backend Prisma schema + API responses

export interface Cycle {
  id: number;
  name: string;
  year: number;
  number: number;
  locked: boolean;
  courseCodes: string[] | null;
  createdAt: string;
  cycleWeeks: CycleWeek[];
}

export interface CycleWeek {
  id: number;
  cycleId: number;
  week: number;
  startDate: string | null;
  endDate: string | null;
}

export interface Station {
  id: number;
  labId: number;
  number: number;
  side: 'LH' | 'RH';
}

export interface Booking {
  id: number;
  cycleId: number;
  stationId: number;
  shift: 'AM' | 'PM';
  week: number;
  traineeName: string;
  contactId: string | null;
  bookedAt: string;
}

export type Shift = 'AM' | 'PM';
export type LabType = 'REGULAR' | 'PRE_EXAM';
export type Side = 'LH' | 'RH' | 'ALL';

export interface Filters {
  shift: Shift;
  labType: LabType;
  side: Side;
}

export interface GridCell {
  stationId: number;
  week: number;
  booked: boolean;
  traineeName?: string;
  contactId?: string;
  bookingId?: number;
}

export interface GridData {
  stations: Array<{
    id: number;
    number: number;
    side: string;
    labName: string;
    cells: Record<number, GridCell>;
  }>;
  weeks: number[];
  cycleWeeks: CycleWeek[];
}

export interface SearchCriteria {
  startWeek: number;
  endWeek: number;
  weeksNeeded: number;
}

export interface Combination {
  stationId: number;
  stationNumber: number;
  labName: string;
  side: string;
  availableWeeks: number[];
}

export interface HubSpotContact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  student_id?: string;
  lifecyclestage?: string;
}

export interface RegistrationEntry {
  seatNumber: number;
  traineeName: string;
  contactId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  paymentStatus: string;
  cycleCount: number;
  isRoadmap: boolean;
  isAFK: boolean;
  isACJ: boolean;
  examDate: string | null;
}

// API response envelope
export interface ApiResponse<T> {
  data: T;
  message: string;
}

export interface ApiListResponse<T> {
  data: T[];
  count: number;
  message: string;
}

export interface ApiError {
  error: string;
  details?: Record<string, string>;
}
```

---

## Task 5.5 — Migrate Frontend Files to TypeScript

**Complexity: Large** | **Files:** All `frontend/src/*.jsx` → `*.tsx`, `*.js` → `*.ts`

**Migration order:**

1. `config.ts` — simple, no dependencies
2. `api.ts` — typed API client with generic response types
3. `types/index.ts` — (done in 5.4)
4. `main.tsx` — entry point
5. `App.tsx` — main component
6. Components (one at a time):
   - `LoginPage.tsx`
   - `FilterBar.tsx`
   - `CycleTabs.tsx`
   - `SearchCriteriaForm.tsx`
   - `SearchResults.tsx`
   - `ContactSearch.tsx`
   - `BookingSection.tsx`
   - `AvailabilityGrid.tsx`
   - `CellBookingDialog.tsx`
   - `StudentInfoDialog.tsx`
   - `RegistrationList.tsx`
   - `AnalyticsDashboard.tsx`

**Tip:** Rename `.jsx` → `.tsx` one file at a time. Fix all TS errors in that file before moving to the next. Don't use `any` — use the types from `types/index.ts`.

**Validation:** `npm run typecheck` passes with 0 errors. `npm run build` succeeds.

---

## Phase 5 Checklist

| #   | Task                             | Complexity | Status |
| --- | -------------------------------- | ---------- | ------ |
| 5.1 | Backend TypeScript setup         | Medium     | [ ]    |
| 5.2 | Migrate backend to TypeScript    | Large      | [ ]    |
| 5.3 | Frontend TypeScript setup        | Medium     | [ ]    |
| 5.4 | Create frontend type definitions | Medium     | [ ]    |
| 5.5 | Migrate frontend to TypeScript   | Large      | [ ]    |

**Phase 5 Validation:** `npm run typecheck` passes in both directories. `npm run build` succeeds. Zero `any` types anywhere.

---

# Phase 6: API Documentation & Backend Hardening

**Why now:** With TypeScript in place, you can auto-generate OpenAPI specs and frontend types. This phase also plugs remaining security/scalability gaps in the backend.

**Current state:** No OpenAPI/Swagger, no CSRF protection, no pagination, no response compression, single admin password, no audit trail.

---

## Task 6.1 — Add OpenAPI/Swagger Documentation

**Complexity: Medium** | **Files:** `backend/src/app.ts`, route files (JSDoc annotations)

```bash
cd backend && npm install swagger-jsdoc swagger-ui-express
npm install -D @types/swagger-jsdoc @types/swagger-ui-express
```

Create `backend/src/swagger.ts`:

```ts
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'NDECC Scheduler API',
      version: '2.5.0',
      description: 'Lab scheduling and registration management',
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token' },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/schemas/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
```

In `app.ts`:

```ts
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
```

Add JSDoc/OpenAPI annotations to each route file (example):

```ts
/**
 * @openapi
 * /api/v1/cycles:
 *   get:
 *     summary: List all cycles
 *     tags: [Cycles]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: Cycles fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Cycle'
 */
```

**Validation:** Visit `http://localhost:5001/api/docs` — Swagger UI should render with all endpoints.

---

## Task 6.2 — Frontend Type Generation from OpenAPI

**Complexity: Small** | **Files:** `frontend/package.json`, `frontend/src/types/api.d.ts` (generated)

```bash
cd frontend && npm install -D openapi-typescript
```

Add script to `frontend/package.json`:

```json
"generate:types": "npx openapi-typescript http://localhost:5001/api/docs.json -o src/types/api.d.ts"
```

**Workflow:**

1. Backend changes an endpoint schema
2. Run `npm run generate:types` in frontend
3. TypeScript compiler catches any mismatches at build time

**Validation:** Generated types match manually written types from Task 5.4.

---

## Task 6.3 — Add CSRF Protection

**Complexity: Small** | **Files:** `backend/src/app.ts`

```bash
cd backend && npm install csrf-csrf
```

```ts
import { doubleCsrf } from 'csrf-csrf';

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => config.jwtSecret,
  cookieName: '__csrf',
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: config.isProduction },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
});

// Apply to all state-changing routes
app.use('/api/v1', doubleCsrfProtection);

// Expose token endpoint
app.get('/api/csrf-token', (req, res) => {
  res.json({ token: generateToken(req, res) });
});
```

Frontend `api.ts` — fetch CSRF token on init and attach to all POST/PATCH/DELETE requests:

```ts
let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    const res = await axios.get('/api/csrf-token');
    csrfToken = res.data.token;
  }
  return csrfToken;
}

api.interceptors.request.use(async (config) => {
  if (['post', 'patch', 'put', 'delete'].includes(config.method ?? '')) {
    config.headers['X-CSRF-Token'] = await getCsrfToken();
  }
  return config;
});
```

---

## Task 6.4 — Add Pagination to List Endpoints

**Complexity: Medium** | **Files:** `services/cycleService.ts`, `services/analyticsService.ts`, `schemas/`, `middleware/respond.ts`

Add pagination schema:

```ts
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
```

Update `respond.ts`:

```ts
paginated(res: Response, items: any[], total: number, page: number, limit: number, message = 'Fetched') {
  return res.json({
    data: items,
    count: items.length,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    message,
  });
}
```

Apply to: `/api/v1/cycles`, `/api/v1/cycles/:id/registration`, analytics endpoints.

**Note:** Grid endpoint does NOT need pagination (it's always bounded by stations × 12 weeks).

---

## Task 6.5 — Add Response Compression

**Complexity: Small** | **Files:** `backend/src/app.ts`

```bash
cd backend && npm install compression
npm install -D @types/compression
```

```ts
import compression from 'compression';
app.use(compression()); // Add before routes, after Helmet
```

**Impact:** Grid/registration JSON responses (~50-200KB) will compress by ~70-80%.

---

## Task 6.6 — Add Request Audit Logging

**Complexity: Small** | **Files:** `backend/src/middleware/auditLog.ts` (new)

```ts
import logger from '../logger';

export function auditLog(req: AuthRequest, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      logger.info(
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          user: req.user?.role ?? 'anonymous',
          durationMs: Date.now() - start,
          ip: req.ip,
        },
        'audit',
      );
    }
  });
  next();
}
```

Apply in `app.ts`: `app.use(auditLog);`

---

## Phase 6 Checklist

| #   | Task                                  | Complexity | Status |
| --- | ------------------------------------- | ---------- | ------ |
| 6.1 | OpenAPI/Swagger documentation         | Medium     | [ ]    |
| 6.2 | Frontend type generation from OpenAPI | Small      | [ ]    |
| 6.3 | CSRF protection                       | Small      | [ ]    |
| 6.4 | Pagination on list endpoints          | Medium     | [ ]    |
| 6.5 | Response compression                  | Small      | [ ]    |
| 6.6 | Request audit logging                 | Small      | [ ]    |

**Phase 6 Validation:** Swagger UI renders all endpoints. Frontend types auto-generated. CSRF token attached to mutations. Paginated response on cycle list. Audit logs visible in structured format.

---

# Phase 7: Frontend Modernization

**Why now:** With TypeScript and API contracts in place, the frontend can be properly modernized with type-safe data fetching, proper routing, and state management.

**Current state:** No router (URL doesn't change), props drilling through 500-line App.jsx, manual useEffect+fetch, no form validation library, no error boundaries.

---

## Task 7.1 — Add React Router

**Complexity: Medium** | **Files:** `frontend/src/main.tsx`, `frontend/src/App.tsx`, new route components

```bash
cd frontend && npm install react-router-dom
```

Route structure:

```
/login          → LoginPage
/               → redirect to /schedule
/schedule       → ScheduleView (grid + booking)
/registration   → RegistrationList
/analytics      → AnalyticsDashboard
```

Create `frontend/src/router.tsx`:

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import LoginPage from './components/LoginPage';
import ScheduleView from './views/ScheduleView';
import RegistrationList from './components/RegistrationList';
import AnalyticsDashboard from './components/AnalyticsDashboard';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />, // Shared header, nav, cycle tabs
    children: [
      { index: true, element: <Navigate to="/schedule" replace /> },
      { path: 'schedule', element: <ScheduleView /> },
      { path: 'registration', element: <RegistrationList /> },
      { path: 'analytics', element: <AnalyticsDashboard /> },
    ],
  },
]);
```

In `main.tsx`:

```tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

root.render(<RouterProvider router={router} />);
```

**Benefit:** Browser back/forward work, deep linking works, URL is shareable.

---

## Task 7.2 — Add State Management (Zustand)

**Complexity: Medium** | **Files:** `frontend/src/stores/` (new directory)

```bash
cd frontend && npm install zustand
```

Create `frontend/src/stores/cycleStore.ts`:

```ts
import { create } from 'zustand';
import type { Cycle, Filters, Shift, LabType, Side } from '../types';

interface CycleState {
  cycles: Cycle[];
  activeCycleId: number | null;
  filters: Filters;
  setCycles: (cycles: Cycle[]) => void;
  setActiveCycleId: (id: number | null) => void;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
}

export const useCycleStore = create<CycleState>((set) => ({
  cycles: [],
  activeCycleId: null,
  filters: { shift: 'AM', labType: 'REGULAR', side: 'ALL' },
  setCycles: (cycles) => set({ cycles }),
  setActiveCycleId: (id) => set({ activeCycleId: id }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
}));
```

Create `frontend/src/stores/authStore.ts`:

```ts
import { create } from 'zustand';

interface AuthState {
  authenticated: boolean;
  setAuthenticated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authenticated: false,
  setAuthenticated: (val) => set({ authenticated: val }),
}));
```

**After:** Remove all state from `App.tsx` — components read from stores directly. No more props drilling.

---

## Task 7.3 — Add TanStack Query for Server State

**Complexity: Medium** | **Files:** `frontend/src/main.tsx`, `frontend/src/hooks/` (new)

```bash
cd frontend && npm install @tanstack/react-query
```

In `main.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

root.render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
```

Create query hooks in `frontend/src/hooks/`:

`useCycles.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCycles, createCycle, deleteCycle } from '../api';

export function useCycles() {
  return useQuery({ queryKey: ['cycles'], queryFn: fetchCycles });
}

export function useCreateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCycle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycles'] }),
  });
}
```

`useGrid.ts`:

```ts
export function useGrid(cycleId: number | null, shift: Shift, labType: LabType, side: Side) {
  return useQuery({
    queryKey: ['grid', cycleId, shift, labType, side],
    queryFn: () => fetchGrid(cycleId!, shift, labType, side),
    enabled: !!cycleId,
  });
}
```

**After:** Delete ALL `useEffect(() => { fetch... }, [])` patterns from components. Delete manual `isLoading`/`error` state — TanStack Query provides these.

---

## Task 7.4 — Add React Hook Form + Zod

**Complexity: Medium** | **Files:** `frontend/src/schemas/`, dialog/form components

```bash
cd frontend && npm install react-hook-form @hookform/resolvers zod
```

Create `frontend/src/schemas/booking.ts`:

```ts
import { z } from 'zod';

export const bookingSchema = z.object({
  traineeName: z.string().min(1, 'Name is required').max(150, 'Name too long'),
  contactId: z.string().optional(),
});

export type BookingFormData = z.infer<typeof bookingSchema>;
```

Create `frontend/src/schemas/cycle.ts`:

```ts
import { z } from 'zod';

export const createCycleSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  courseCodes: z.array(z.string().min(1)).optional(),
});

export type CreateCycleFormData = z.infer<typeof createCycleSchema>;
```

Refactor `CellBookingDialog`, `SearchCriteriaForm` to use:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingSchema, BookingFormData } from '../schemas/booking';

const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm<BookingFormData>({
  resolver: zodResolver(bookingSchema),
});
```

---

## Task 7.5 — Decompose App.jsx God Component

**Complexity: Large** | **Files:** `frontend/src/App.tsx` → split into multiple files

Target structure:

```
src/
├── layouts/
│   └── AppLayout.tsx          # Header, nav tabs, cycle tabs, <Outlet />
├── views/
│   └── ScheduleView.tsx       # Grid + search + booking (was bulk of App.jsx)
├── components/
│   ├── Header.tsx             # App title, view nav, logout
│   └── ... (existing components)
├── stores/                    # Zustand stores (from 7.2)
├── hooks/                     # TanStack Query hooks (from 7.3)
└── App.tsx                    # ~20 lines: auth check + router render
```

`App.tsx` becomes:

```tsx
export default function App() {
  return <RouterProvider router={router} />;
}
```

`AppLayout.tsx` handles:

- Auth guard (redirect to /login if not authenticated)
- Header with navigation
- CycleTabs
- `<Outlet />` for child routes

`ScheduleView.tsx` handles:

- FilterBar
- SearchCriteriaForm + SearchResults
- BookingSection
- AvailabilityGrid
- Dialogs (CellBookingDialog, StudentInfoDialog)

---

## Task 7.6 — Add Error Boundaries

**Complexity: Small** | **Files:** `frontend/src/components/ErrorBoundary.tsx` (new)

```tsx
import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-primary text-white rounded-md"
            >
              Try Again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

Wrap each route in `router.tsx`:

```tsx
{ path: 'schedule', element: <ErrorBoundary><ScheduleView /></ErrorBoundary> }
```

---

## Task 7.7 — Fix API Client (Stop Swallowing Errors)

**Complexity: Small** | **Files:** `frontend/src/api.ts`

Current `api.js` catches errors and returns `[]`/`null` — this silently hides failures.

**Fix:** Let errors propagate. TanStack Query handles error state:

```ts
// BEFORE
export async function fetchCycles() {
  try {
    const res = await axios.get('/api/v1/cycles');
    return res.data.data;
  } catch (err) {
    console.error(err);
    return []; // ❌ Swallowed error
  }
}

// AFTER
export async function fetchCycles(): Promise<Cycle[]> {
  const res = await axios.get<ApiResponse<Cycle[]>>('/api/v1/cycles');
  return res.data.data; // Throws on failure — TanStack Query catches it
}
```

Apply to ALL API functions — remove every try/catch that returns a fallback value.

---

## Phase 7 Checklist

| #   | Task                                    | Complexity | Status |
| --- | --------------------------------------- | ---------- | ------ |
| 7.1 | React Router                            | Medium     | [ ]    |
| 7.2 | Zustand state management                | Medium     | [ ]    |
| 7.3 | TanStack Query for server state         | Medium     | [ ]    |
| 7.4 | React Hook Form + Zod                   | Medium     | [ ]    |
| 7.5 | Decompose App.jsx                       | Large      | [ ]    |
| 7.6 | Error boundaries                        | Small      | [ ]    |
| 7.7 | Fix API client (stop swallowing errors) | Small      | [ ]    |

**Phase 7 Validation:** URLs change on navigation. Back/forward buttons work. Data fetching shows loading/error states via TanStack Query. Forms validate with Zod. No component >200 lines. No props drilling beyond 1 level.

---

# Phase 8: Design System & Accessibility

**Why now:** With the frontend properly structured (router, state, typed), the design system can be applied consistently.

**Current state:** Hardcoded Tailwind colors everywhere, no CSS variables, no dark mode, no loading skeletons (except analytics), `confirm()` dialogs, no ARIA labels, Sonner installed but unused.

---

## Task 8.1 — Set Up Semantic CSS Variables

**Complexity: Small** | **Files:** `frontend/src/style.css`, `frontend/tailwind.config.ts`

Add to `style.css`:

```css
:root {
  --color-background: 248 250 252; /* slate-50 */
  --color-foreground: 15 23 42; /* slate-900 */
  --color-card: 255 255 255; /* white */
  --color-card-foreground: 15 23 42;
  --color-primary: 6 96 178; /* brand-500 */
  --color-primary-foreground: 255 255 255;
  --color-muted: 241 245 249; /* slate-100 */
  --color-muted-foreground: 100 116 139; /* slate-500 */
  --color-border: 226 232 240; /* slate-200 */
  --color-success: 22 163 74; /* green-600 */
  --color-destructive: 220 38 38; /* red-600 */
  --color-warning: 217 119 6; /* amber-600 */
}

.dark {
  --color-background: 15 23 42; /* slate-900 */
  --color-foreground: 248 250 252; /* slate-50 */
  --color-card: 30 41 59; /* slate-800 */
  --color-card-foreground: 248 250 252;
  --color-primary: 96 165 250; /* blue-400 */
  --color-primary-foreground: 15 23 42;
  --color-muted: 51 65 85; /* slate-700 */
  --color-muted-foreground: 148 163 184; /* slate-400 */
  --color-border: 51 65 85; /* slate-700 */
  --color-success: 74 222 128; /* green-400 */
  --color-destructive: 248 113 113; /* red-400 */
  --color-warning: 251 191 36; /* amber-400 */
}
```

Extend `tailwind.config.ts`:

```ts
theme: {
  extend: {
    colors: {
      background: 'rgb(var(--color-background) / <alpha-value>)',
      foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
      card: 'rgb(var(--color-card) / <alpha-value>)',
      'card-foreground': 'rgb(var(--color-card-foreground) / <alpha-value>)',
      primary: 'rgb(var(--color-primary) / <alpha-value>)',
      'primary-foreground': 'rgb(var(--color-primary-foreground) / <alpha-value>)',
      muted: 'rgb(var(--color-muted) / <alpha-value>)',
      'muted-foreground': 'rgb(var(--color-muted-foreground) / <alpha-value>)',
      border: 'rgb(var(--color-border) / <alpha-value>)',
      success: 'rgb(var(--color-success) / <alpha-value>)',
      destructive: 'rgb(var(--color-destructive) / <alpha-value>)',
      warning: 'rgb(var(--color-warning) / <alpha-value>)',
    },
  },
}
```

---

## Task 8.2 — Replace ALL Hardcoded Colors

**Complexity: Large** | **Files:** Every component

Replacement map (apply across ALL components):

| Pattern           | Before                            | After                                    |
| ----------------- | --------------------------------- | ---------------------------------------- |
| Page background   | `bg-gray-50`                      | `bg-background`                          |
| Card/panel        | `bg-white`                        | `bg-card`                                |
| Primary text      | `text-gray-900`                   | `text-foreground`                        |
| Secondary text    | `text-gray-500/600/700`           | `text-muted-foreground`                  |
| Borders           | `border-gray-200/300`             | `border-border`                          |
| Booked cells      | `bg-green-100 text-green-800`     | `bg-success/10 text-success`             |
| Error/danger      | `bg-red-50/100 text-red-600/800`  | `bg-destructive/10 text-destructive`     |
| Warning           | `bg-yellow-50 text-yellow-900`    | `bg-warning/10 text-warning`             |
| Info/accent       | `bg-blue-50 text-blue-900`        | `bg-primary/10 text-primary`             |
| Buttons (primary) | `bg-brand-500 hover:bg-brand-600` | `bg-primary hover:bg-primary/90`         |
| Buttons (danger)  | `bg-red-600 hover:bg-red-700`     | `bg-destructive hover:bg-destructive/90` |

---

## Task 8.3 — Enable Dark Mode

**Complexity: Small** | **Files:** `tailwind.config.ts`, `index.html`, new `DarkModeToggle` component

In `tailwind.config.ts`:

```ts
darkMode: 'class',
```

In `index.html` (prevent FOUC):

```html
<script>
  if (
    localStorage.theme === 'dark' ||
    (!localStorage.theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  }
</script>
```

Create `DarkModeToggle.tsx`:

```tsx
export default function DarkModeToggle() {
  const toggleDark = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
  };

  return (
    <button
      onClick={toggleDark}
      aria-label="Toggle dark mode"
      className="p-2 rounded-md hover:bg-muted transition-colors"
    >
      {/* Sun/Moon icon */}
    </button>
  );
}
```

---

## Task 8.4 — Activate Sonner Toast Notifications

**Complexity: Small** | **Files:** All components that show inline errors/success

Sonner is already installed + `<Toaster>` is in App. Now use it:

```tsx
import { toast } from 'sonner';

// Booking success
toast.success('Slot booked successfully');

// Booking error
toast.error('Failed to book slot');

// Cycle deleted
toast.success('Cycle deleted');

// CSV exported
toast.info('CSV downloaded');
```

**Replace:** All inline `{error && <div className="bg-red-50">...` with `toast.error()`. All `{bookingSuccess && <div>...` with `toast.success()`.

---

## Task 8.5 — Add Loading Skeletons

**Complexity: Medium** | **Files:** New `components/Skeleton.tsx`, update grid/registration/search components

Create `Skeleton.tsx`:

```tsx
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className ?? ''}`} />;
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

Replace "Loading..." text with `<SkeletonTable />` in:

- `AvailabilityGrid` — while grid data loads
- `RegistrationList` — while registration list loads
- `SearchResults` — while searching

---

## Task 8.6 — Replace `confirm()` with Custom Dialog

**Complexity: Small** | **Files:** `components/ConfirmDialog.tsx` (new), `AvailabilityGrid.tsx`

Create a reusable `ConfirmDialog`:

```tsx
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}
```

Replace all `window.confirm()` calls (grid reset, cycle delete) with state-driven dialog.

---

## Task 8.7 — Fix Accessibility Issues

**Complexity: Medium** | **Files:** Multiple components

| Issue                                      | Fix                                              |
| ------------------------------------------ | ------------------------------------------------ |
| `<span onClick>` in CycleTabs              | Change to `<button type="button">`               |
| No `aria-label` on icon buttons            | Add descriptive labels                           |
| No focus management in dialogs             | Add `autoFocus` on first input, trap focus       |
| No skip navigation link                    | Add "Skip to main content" link                  |
| Color contrast                             | Verify all text meets WCAG AA (4.5:1 ratio)      |
| Grid cells not keyboard navigable          | Add `tabIndex={0}` + `onKeyDown` for Enter/Space |
| No `<main>`, `<nav>`, `<header>` landmarks | Replace `<div>` wrappers with semantic HTML      |

---

## Task 8.8 — Replace Inline Styles with Tailwind

**Complexity: Small** | **Files:** `AvailabilityGrid.tsx`

| Inline Style                                                                  | Tailwind Class           |
| ----------------------------------------------------------------------------- | ------------------------ |
| `style={{ tableLayout: 'fixed' }}`                                            | `table-fixed`            |
| `style={{ width: '160px' }}`                                                  | `w-40`                   |
| `style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}` | `max-w-[100px] truncate` |
| `style={{ minWidth: '60px' }}`                                                | `min-w-[60px]`           |

---

## Phase 8 Checklist

| #   | Task                         | Complexity | Status |
| --- | ---------------------------- | ---------- | ------ |
| 8.1 | Semantic CSS variables       | Small      | [ ]    |
| 8.2 | Replace all hardcoded colors | Large      | [ ]    |
| 8.3 | Enable dark mode             | Small      | [ ]    |
| 8.4 | Activate Sonner toasts       | Small      | [ ]    |
| 8.5 | Loading skeletons            | Medium     | [ ]    |
| 8.6 | Custom confirm dialog        | Small      | [ ]    |
| 8.7 | Accessibility fixes          | Medium     | [ ]    |
| 8.8 | Replace inline styles        | Small      | [ ]    |

**Phase 8 Validation:** Toggle dark mode — all components render correctly. No hardcoded color classes in codebase (`grep -r "bg-red\|bg-green\|bg-gray\|text-gray" src/`). Skeleton loaders visible during data fetch. Toast notifications on all user actions. Tab through entire app with keyboard only.

---

# Phase 9: Comprehensive Testing

**Why now:** With the codebase modernized, typed, and properly structured — tests can be written effectively. Testing before this phase would mean rewriting tests after every refactor.

**Current state:** 18 backend tests, 6 frontend tests (1 file), 0 E2E tests, no coverage enforcement.

---

## Task 9.1 — Backend Unit Tests for Services

**Complexity: Large** | **Files:** `backend/__tests__/services/`

Every service function must have tests:

| Service               | Functions to Test                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `cycleService`        | `listCycles`, `createCycle`, `updateWeeks`, `updateCourseCodes`, `setLocked`, `deleteCycle` |
| `bookingService`      | `bookSlots` (happy + conflict), `unbookSlots`, `findAvailableBlocks`, `resetCycle`          |
| `gridService`         | `buildGrid`, `exportGrid`                                                                   |
| `registrationService` | `getRegistrationList`, `exportRegistrationCsv`                                              |
| `analyticsService`    | `getSeatingAnalytics`, `getRegistrationAnalytics`                                           |

**HubSpot service:** Mock `axios` using `jest.mock('axios')`:

```ts
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

test('searchContacts returns formatted results', async () => {
  mockedAxios.post.mockResolvedValueOnce({
    data: {
      results: [
        /* mock */
      ],
    },
  });
  const results = await hubspot.searchContacts('John', 10);
  expect(results).toHaveLength(1);
  expect(results[0]).toHaveProperty('firstname');
});
```

**Target:** 70% line coverage, 70% function coverage.

---

## Task 9.2 — Backend Integration Tests

**Complexity: Medium** | **Files:** `backend/__tests__/routes/`

Expand existing tests to cover all endpoints:

| Route File     | Tests Needed                                           |
| -------------- | ------------------------------------------------------ |
| `auth`         | ✅ Existing (5 tests)                                  |
| `cycles`       | ✅ Existing (4 tests) — add course-codes, lock, unlock |
| `bookings`     | Book, unbook, find, reset (with locked cycle = 403)    |
| `grid`         | Build grid, export CSV                                 |
| `registration` | List, export CSV                                       |
| `analytics`    | Seating, registration                                  |
| `contacts`     | Search, get by ID (mock HubSpot)                       |

---

## Task 9.3 — Frontend Component Tests

**Complexity: Large** | **Files:** `frontend/src/__tests__/`

```bash
cd frontend && npm install -D @testing-library/user-event @vitest/coverage-v8 msw
```

Use MSW (Mock Service Worker) for API mocking:

```ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('/api/v1/cycles', () =>
    HttpResponse.json({
      data: [{ id: 1, name: 'Cycle 1', year: 2026, locked: false }],
      count: 1,
      message: 'Fetched',
    }),
  ),
);
```

**Components to test:**

- `LoginPage` — login flow, error display
- `CycleTabs` — cycle selection, create, delete, lock/unlock
- `FilterBar` — filter changes
- `SearchCriteriaForm` — validation, submission
- `ContactSearch` — debounced search, selection
- `BookingSection` — booking flow
- `RegistrationList` — data display, filtering, export
- `AnalyticsDashboard` — chart rendering, PDF export

**Target:** 60% line coverage, 60% function coverage.

---

## Task 9.4 — E2E Tests (Playwright)

**Complexity: Medium** | **Files:** `e2e/` (new directory at project root)

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `e2e/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: [
    { command: 'cd backend && npm run dev', port: 5001, reuseExistingServer: true },
    { command: 'cd frontend && npm start', port: 5173, reuseExistingServer: true },
  ],
  use: { baseURL: 'http://localhost:5173' },
});
```

**Critical flows to test (minimum 5):**

1. Login → see schedule page
2. Create cycle → appears in tabs → delete cycle
3. Select cycle → load grid → book a slot → verify → unbook
4. Search HubSpot contact → select → book with contact info
5. Navigate to registration list → verify data → export CSV

---

## Task 9.5 — Add Coverage Thresholds to CI

**Complexity: Small** | **Files:** `jest.config.ts`, `vite.config.ts`, `.github/workflows/ci.yml`

**Backend** (`jest.config.ts`):

```ts
coverageThreshold: {
  global: { lines: 70, functions: 70, branches: 60, statements: 70 },
},
```

**Frontend** (`vite.config.ts`):

```ts
test: {
  coverage: {
    provider: 'v8',
    thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 },
  },
}
```

**CI** — update jobs to run with coverage:

```yaml
- run: cd backend && npm test -- --coverage
- run: cd frontend && npm test -- --coverage
```

---

## Phase 9 Checklist

| #   | Task                           | Complexity | Status |
| --- | ------------------------------ | ---------- | ------ |
| 9.1 | Backend service unit tests     | Large      | [ ]    |
| 9.2 | Backend integration tests      | Medium     | [ ]    |
| 9.3 | Frontend component tests (MSW) | Large      | [ ]    |
| 9.4 | E2E tests (Playwright)         | Medium     | [ ]    |
| 9.5 | Coverage thresholds in CI      | Small      | [ ]    |

**Phase 9 Validation:** `npm test -- --coverage` passes in both directories with thresholds met. Playwright runs 5 flows in CI. No PR can merge with failing tests.

---

# Phase 10: Performance & Scalability

**Why now:** With everything else solid, optimize for production load. These are the "last mile" improvements.

**Current state:** No response compression (done in Phase 6), no code splitting, no lazy loading, no caching layer, HubSpot calls block requests for 5-10 seconds.

---

## Task 10.1 — Lazy Load Frontend Routes

**Complexity: Small** | **Files:** `frontend/src/router.tsx`

```tsx
import { lazy, Suspense } from 'react';

const ScheduleView = lazy(() => import('./views/ScheduleView'));
const RegistrationList = lazy(() => import('./components/RegistrationList'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));

// In router:
{
  path: 'analytics',
  element: (
    <Suspense fallback={<SkeletonTable />}>
      <AnalyticsDashboard />
    </Suspense>
  ),
}
```

**Impact:** Initial bundle size decreases. Analytics + Registration code only loaded when navigated to.

---

## Task 10.2 — Add Redis Caching Layer

**Complexity: Medium** | **Files:** `backend/src/cache.ts` (new), services that need caching

```bash
cd backend && npm install ioredis
```

Create `backend/src/cache.ts`:

```ts
import Redis from 'ioredis';
import logger from './logger';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  const val = await redis.get(key);
  return val ? JSON.parse(val) : null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheInvalidate(pattern: string): Promise<void> {
  if (!redis) return;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
```

**What to cache:**
| Data | TTL | Invalidation |
|------|-----|-------------|
| HubSpot deal stage names | 5 min | N/A (rarely changes) |
| Registration lists | 60 sec | On booking changes |
| Grid data | 30 sec | On book/unbook |
| Analytics | 2 min | On booking changes |

**Graceful degradation:** If `REDIS_URL` not set, caching is a no-op. App works without Redis.

Add Redis to `docker-compose.dev.yml`:

```yaml
redis:
  image: redis:7-alpine
  ports: ['6379:6379']
```

---

## Task 10.3 — Add Background Job Queue for HubSpot

**Complexity: Medium** | **Files:** `backend/src/queue.ts` (new), `backend/src/workers/` (new)

```bash
cd backend && npm install bullmq
```

Create `backend/src/queue.ts`:

```ts
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = process.env.REDIS_URL ? new IORedis(process.env.REDIS_URL) : undefined;

export const registrationQueue = connection ? new Queue('registration', { connection }) : null;
```

Create `backend/src/workers/registrationWorker.ts`:

```ts
import { Worker } from 'bullmq';
import { hubspot } from '../hubspot';
import { cacheSet } from '../cache';

new Worker(
  'registration',
  async (job) => {
    const { courseCodes, shift, cycleId } = job.data;
    const result = await hubspot.buildRegistrationList(courseCodes, shift);
    await cacheSet(`registration:${cycleId}:${shift}`, result, 300);
    return result;
  },
  { connection },
);
```

Update `registrationService` to queue the job + return cached data if available:

```ts
async function getRegistrationList(cycleId: number, shift: string, refresh: boolean) {
  const cacheKey = `registration:${cycleId}:${shift}`;

  if (!refresh) {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;
  }

  if (registrationQueue) {
    await registrationQueue.add('build', { cycleId, courseCodes, shift });
    return { status: 'building', message: 'Registration list is being built.' };
  }

  // Fallback: synchronous (no Redis)
  return hubspot.buildRegistrationList(courseCodes, shift);
}
```

**Impact:** Registration list requests return instantly (from cache or "building" status). HubSpot calls happen in background.

---

## Task 10.4 — Optimize Bundle Size

**Complexity: Small** | **Files:** `frontend/vite.config.ts`

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-charts': ['recharts'],
        'vendor-pdf': ['jspdf', 'html-to-image'],
        'vendor-query': ['@tanstack/react-query', 'axios'],
      },
    },
  },
}
```

**Impact:** Vendor chunks cached separately — app code changes don't invalidate vendor cache.

---

## Task 10.5 — Add Debounced Search Input Utility

**Complexity: Small** | **Files:** `frontend/src/hooks/useDebounce.ts` (new)

```ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

Use in `ContactSearch` and any future search inputs instead of manual debounce logic.

---

## Phase 10 Checklist

| #    | Task                                 | Complexity | Status |
| ---- | ------------------------------------ | ---------- | ------ |
| 10.1 | Lazy load frontend routes            | Small      | [ ]    |
| 10.2 | Redis caching layer                  | Medium     | [ ]    |
| 10.3 | Background job queue (BullMQ)        | Medium     | [ ]    |
| 10.4 | Optimize bundle size (manual chunks) | Small      | [ ]    |
| 10.5 | Debounced search utility hook        | Small      | [ ]    |

**Phase 10 Validation:** `npm run build` — check bundle analysis (no single chunk >200KB). Registration list loads from cache in <100ms. Lazy loaded routes show skeleton during load.

---

# Appendix A: Complete Dependency Additions

## Backend (All Phases)

```bash
cd backend

# Phase 3: Tooling
npm install -D eslint @eslint/js globals

# Phase 4: Database & Observability
npm install pino pino-http @sentry/node
npm install -D pino-pretty

# Phase 5: TypeScript
npm install -D typescript @types/node @types/express @types/jsonwebtoken @types/bcryptjs @types/cors @types/cookie-parser tsx

# Phase 6: API Docs & Hardening
npm install swagger-jsdoc swagger-ui-express csrf-csrf compression
npm install -D @types/swagger-jsdoc @types/swagger-ui-express @types/compression

# Phase 10: Performance
npm install ioredis bullmq
```

## Frontend (All Phases)

```bash
cd frontend

# Phase 3: Tooling
npm install -D eslint @eslint/js eslint-plugin-react eslint-plugin-react-hooks globals

# Phase 4: Observability
npm install @sentry/react

# Phase 5: TypeScript
npm install -D typescript @types/react @types/react-dom

# Phase 6: Contract Sync
npm install -D openapi-typescript

# Phase 7: Modernization
npm install react-router-dom zustand @tanstack/react-query react-hook-form @hookform/resolvers zod

# Phase 9: Testing
npm install -D @testing-library/user-event @vitest/coverage-v8 msw

# Phase 10: (no new deps — built into Vite)
```

## Root Level

```bash
# Phase 3: Pre-commit hooks
npm install -D husky lint-staged prettier

# Phase 9: E2E
npm install -D @playwright/test
```

---

# Appendix B: Target Architecture After All Phases

```
NDECCSchedApp/
├── .github/workflows/
│   └── ci.yml                        # Lint → Typecheck → Test → Build → Deploy
├── .husky/
│   └── pre-commit                    # lint-staged
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Entry point
│   │   ├── app.ts                    # Express setup (Helmet, CORS, compression, Swagger, routes)
│   │   ├── config.ts                 # Typed env config with validation
│   │   ├── db.ts                     # Prisma client (typed)
│   │   ├── logger.ts                 # Pino structured logging
│   │   ├── cache.ts                  # Redis cache (graceful degradation)
│   │   ├── queue.ts                  # BullMQ job queue
│   │   ├── swagger.ts                # OpenAPI spec generation
│   │   ├── lib/
│   │   │   └── AppError.ts           # Typed custom error
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT + CSRF verification
│   │   │   ├── validate.ts           # Joi validation (generic)
│   │   │   ├── respond.ts            # Response envelope helpers
│   │   │   ├── errorHandler.ts       # Global error handler + Sentry
│   │   │   └── auditLog.ts           # Request audit logging
│   │   ├── schemas/                  # Joi schemas (typed)
│   │   ├── services/                 # Business logic (typed, cached)
│   │   ├── routes/                   # Thin typed route handlers
│   │   └── hubspot/                  # Split: contacts.ts, deals.ts, registration.ts
│   ├── prisma/
│   │   └── schema.prisma             # PostgreSQL, cascades, indexes
│   ├── __tests__/                    # 70%+ coverage
│   ├── tsconfig.json
│   └── eslint.config.js
├── frontend/
│   ├── src/
│   │   ├── main.tsx                  # React mount + QueryClient + Sentry
│   │   ├── router.tsx                # React Router (lazy loaded)
│   │   ├── api.ts                    # Typed Axios client (no error swallowing)
│   │   ├── types/
│   │   │   ├── index.ts              # Domain types
│   │   │   └── api.d.ts              # Auto-generated from OpenAPI
│   │   ├── stores/                   # Zustand (auth, cycle, UI state)
│   │   ├── hooks/                    # TanStack Query hooks + useDebounce
│   │   ├── schemas/                  # Zod validation schemas
│   │   ├── layouts/
│   │   │   └── AppLayout.tsx         # Header, nav, cycle tabs, <Outlet />
│   │   ├── views/
│   │   │   └── ScheduleView.tsx      # Grid + booking composition
│   │   ├── components/               # Feature components (typed, accessible)
│   │   │   ├── ui/                   # Shared: Skeleton, ConfirmDialog, ErrorBoundary
│   │   │   └── ...
│   │   └── style.css                 # CSS variables (light + dark)
│   ├── __tests__/                    # 60%+ coverage (MSW mocking)
│   ├── tsconfig.json
│   └── eslint.config.js
├── e2e/                              # Playwright E2E tests
├── .editorconfig
├── .prettierrc
└── docker-compose.dev.yml            # PG + Redis + Backend + Frontend
```

---

# Appendix C: Projected Scorecard After Completion

| Category              | Before     | After      | Target   |
| --------------------- | ---------- | ---------- | -------- |
| Type Safety           | 2/10       | 9/10       | 9+       |
| Backend Architecture  | 7/10       | 9/10       | 9+       |
| Frontend Architecture | 4/10       | 9/10       | 9+       |
| Security              | 7/10       | 9/10       | 9+       |
| Testing               | 2/10       | 8/10       | 8+       |
| CI/CD                 | 1/10       | 8/10       | 8+       |
| API Documentation     | 2/10       | 9/10       | 9+       |
| Database              | 6/10       | 9/10       | 9+       |
| Observability         | 1/10       | 8/10       | 8+       |
| DevOps                | 5/10       | 8/10       | 8+       |
| Code Quality Tooling  | 2/10       | 9/10       | 9+       |
| Documentation         | 8/10       | 9/10       | 9+       |
| Performance           | 3/10       | 8/10       | 8+       |
| **Overall**           | **3.8/10** | **8.6/10** | **8.5+** |
