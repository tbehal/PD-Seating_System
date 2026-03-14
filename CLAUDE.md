# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# NDECCSchedApp — Project Instructions

## What This Is

NDECC Scheduler — a 12-week lab booking system for dental education. Single admin manages cycles, books trainee slots across labs/stations/shifts, integrates with HubSpot CRM for student data, and provides analytics dashboards.

## Tech Stack

| Layer           | Tech                                          | Version   |
| --------------- | --------------------------------------------- | --------- |
| Frontend        | React + Vite                                  | 18.2, 7.1 |
| Routing         | React Router                                  | 7.x       |
| Client State    | Zustand                                       | 5.x       |
| Server State    | TanStack Query                                | 5.x       |
| Form Validation | React Hook Form + Zod                         | 7.x, 3.x  |
| Styling         | Tailwind CSS                                  | 3.3       |
| Charts          | Recharts                                      | 3.7       |
| HTTP Client     | Axios                                         | 1.4       |
| Backend         | Express.js (TypeScript)                       | 4.18      |
| Language        | TypeScript (backend), JavaScript (frontend)   | 5.7       |
| ORM             | Prisma                                        | 6.5       |
| Database        | SQLite (dev), PostgreSQL (prod)               | —         |
| Validation (BE) | Joi                                           | 18.0      |
| Auth            | JWT (HttpOnly cookies)                        | —         |
| Testing         | Jest + Supertest (backend), Vitest (frontend) | —         |
| Node            | >=20.19                                       | —         |

## Project Structure

```
NDECCSchedApp/
├── backend/
│   ├── tsconfig.json             # TypeScript config (strict + noUncheckedIndexedAccess)
│   └── src/
│       ├── index.ts              # Entry point (supports Vercel serverless)
│       ├── app.ts                # Express app (middleware + route mounting)
│       ├── config.ts             # Env vars + production validation
│       ├── db.ts                 # Prisma client singleton
│       ├── hubspot.ts            # HubSpot CRM integration (batch APIs + caching)
│       ├── logger.ts             # Pino structured logger
│       ├── lib/AppError.ts       # Custom error class (statusCode, message, details)
│       ├── types/
│       │   ├── express.d.ts      # Express Request augmentation (req.user)
│       │   ├── index.ts          # Shared domain types
│       │   └── hubspot.ts        # HubSpot API response interfaces
│       ├── middleware/
│       │   ├── auth.ts           # requireAuth — JWT from cookies
│       │   ├── validate.ts       # Joi schema validation middleware
│       │   ├── respond.ts        # Response envelope helpers (ok, list, created)
│       │   └── errorHandler.ts   # Global error handler (AppError + Prisma codes)
│       ├── schemas/              # Joi schemas — one per route file (.ts)
│       ├── services/             # Business logic — one per domain (.ts)
│       └── routes/               # Thin HTTP adapters — parse, call service, respond (.ts)
├── frontend/
│   └── src/
│       ├── main.jsx              # React mount
│       ├── App.jsx               # Providers (QueryClient + Router + Toaster)
│       ├── router.jsx            # React Router config (createBrowserRouter)
│       ├── api.js                # Axios client (all API calls, 401 interceptor)
│       ├── config.js             # API base URL
│       ├── stores/               # Zustand stores
│       │   ├── authStore.js      # Auth state (authenticated, setAuthenticated)
│       │   ├── scheduleStore.js  # UI state (activeCycleId, filters, searchCriteria)
│       │   └── themeStore.js     # Theme state (theme, toggleTheme) — drives dark mode + Sonner + charts
│       ├── hooks/                # TanStack Query hooks
│       │   ├── useCycles.js      # Cycle CRUD + lock/unlock mutations
│       │   ├── useGrid.js        # Grid data query (auto-refetch on filter change)
│       │   ├── useBookings.js    # Book/unbook/reset/findCombinations mutations
│       │   ├── useContacts.js    # Contact search/lookup queries
│       │   ├── useRegistration.js # Registration list query + refresh mutation
│       │   ├── useAnalytics.js   # Seating + registration analytics queries
│       │   └── useFocusTrap.js   # Focus trap + Escape callback for dialogs
│       ├── lib/
│       │   └── chartTheme.js     # Reads CSS variables → hex for Recharts
│       ├── schemas/              # Zod validation schemas
│       │   ├── login.js          # Login form (password)
│       │   ├── search.js         # Search criteria (startWeek, endWeek, weeksNeeded)
│       │   ├── booking.js        # Booking form (traineeName, contactId)
│       │   └── cycle.js          # Create cycle form (year, courseCodes)
│       └── components/
│           ├── AppLayout.jsx     # Auth guard + header + nav + CycleTabs + DarkModeToggle + Outlet
│           ├── ScheduleView.jsx  # Grid/search/booking orchestrator
│           ├── ErrorBoundary.jsx # Catch render errors with retry UI
│           ├── DarkModeToggle.jsx # Sun/Moon theme toggle (uses themeStore)
│           ├── ui/               # Shared UI primitives
│           │   ├── Skeleton.jsx  # Shimmer skeleton + SkeletonText
│           │   └── SkeletonTable.jsx # Table loading skeleton
│           └── ...               # Feature-specific components
└── prisma/
    ├── schema.prisma             # DB schema (5 models)
    └── seed.ts                   # Seed data (6 labs, 133 stations)
```

## Running the Project

```bash
# Backend
cd backend && npm install && npx prisma generate && npx prisma migrate deploy && npm run dev
# → http://localhost:5001

# Frontend
cd frontend && npm install && npm start
# → http://localhost:5173 (proxies /api to backend)

# Docker (dev)
docker compose -f docker-compose.dev.yml up --build
```

## Common Commands

```bash
# Backend tests (Jest + Supertest, runs sequentially via --runInBand)
cd backend && npm test                          # all tests
cd backend && npx jest --runInBand <pattern>    # single file, e.g. npx jest --runInBand cycles

# Frontend tests (Vitest)
cd frontend && npm test                         # all tests
cd frontend && npx vitest run <pattern>         # single file, e.g. npx vitest run ScheduleView

# Type checking (backend only — frontend is JavaScript)
cd backend && npm run typecheck                 # tsc --noEmit

# Linting
cd backend && npm run lint                      # ESLint backend
cd frontend && npm run lint                     # ESLint frontend
npm run lint                                    # both (from root)

# Formatting
cd backend && npm run format                    # Prettier backend
cd frontend && npm run format                   # Prettier frontend

# Prisma
cd backend && npx prisma migrate dev --name <description>   # new migration
cd backend && npx prisma studio                              # DB browser
cd backend && npx prisma db seed                             # seed data
```

**Pre-commit hook:** Husky runs `lint-staged` which auto-formats staged `.ts`, `.js`, `.jsx`, `.json`, `.css`, `.md` files with Prettier.

## Environment Variables

```env
# backend/.env
DATABASE_URL=file:./prisma/dev.db        # SQLite for dev
PORT=5001
HUBSPOT_API_KEY=                          # Optional (registration list needs it)
JWT_SECRET=dev-only-secret                # REQUIRED in production
ADMIN_PASSWORD_HASH=                      # REQUIRED in production (bcrypt hash)
NODE_ENV=development
```

Dev login password: `admin123` (hardcoded fallback when ADMIN_PASSWORD_HASH not set).

---

## Backend Conventions (MUST FOLLOW)

### Request Flow

```
Request → Helmet → CORS → JSON parser → Cookie parser → Rate limiter
       → requireAuth (if /api/v1/*) → validate(schema) → Route handler
       → Service function → Prisma DB → respond.ok/list/created
       → errorHandler (catches thrown errors)
```

### Adding a New Endpoint

1. **Schema first** — create/update Joi schema in `schemas/`
2. **Service** — add business logic to the appropriate service in `services/`
3. **Route** — thin adapter in `routes/` that calls the service
4. **Wire** — mount in `app.ts` under the correct router

Example:

```ts
// schemas/myFeature.ts
const mySchema = Joi.object({ name: Joi.string().required() });

// services/myService.ts
async function doThing(data) {
  return prisma.model.create({ data });
}

// routes/myRoute.ts
router.post('/', validate(mySchema), async (req, res, next) => {
  try {
    const result = await myService.doThing(req.body);
    return respond.created(res, result, 'Created.');
  } catch (err) {
    next(err);
  }
});
```

### Response Envelope (NEVER deviate)

```js
// Success (single)
respond.ok(res, data, 'Cycle fetched.'); // → { data: {...}, message: "..." }

// Success (list)
respond.list(res, items, 'Cycles fetched.'); // → { data: [...], count: N, message: "..." }

// Created
respond.created(res, data, 'Cycle created.'); // → 201 { data: {...}, message: "..." }

// Error (thrown via AppError or caught by errorHandler)
// → { error: "Message", details: { field: "error" } }
```

**NEVER** return raw arrays, raw objects, or `{ success: true }`. Always use `respond.*`.

### Error Handling

```js
// Throw AppError for known errors — errorHandler catches them
const AppError = require('../lib/AppError');
throw new AppError(404, 'Cycle not found.');
throw new AppError(409, 'Slot already booked.', { week: 3, station: 'A-12' });
throw new AppError(403, 'Cycle is locked.');

// DO NOT catch errors in routes just to re-format them
// Let them propagate to errorHandler via next(err)
```

### Validation Rules

- Every route MUST have a Joi schema applied via `validate()` middleware
- Validate `body`, `params`, or `query` — specify the source: `validate(schema, 'query')`
- Joi options are: `abortEarly: false`, `stripUnknown: true`, `convert: true`
- Validated value replaces `req[source]` — use `req.body` after validation, not raw input

### Cycle Locking

When `cycle.locked === true`, these operations MUST return 403:

- Booking / unbooking slots
- Updating week dates
- Resetting cycle bookings

Always check lock state in the service layer before mutating.

### HubSpot Integration

- `hubspot.js` handles ALL HubSpot API calls — never call HubSpot directly from routes/services
- Rate limit: 90 req/10sec (HubSpot's limit). Use batch APIs (v3/v4) whenever possible
- In-memory caches: deal stages (5 min), registration lists (60 sec)
- Registration list building uses batch association chains: line_items → deals → contacts
- **Shift code filtering:** Codes with `-AM`/`_AM` → AM only, `-PM`/`_PM` → PM only. Neutral codes (no shift suffix, e.g. deposit codes like `NDECC April 2026 Roadmap Deposit`) → PM shift only. Logic in `filterShiftCodes()` in `registrationService.ts`.

### Database

- **Provider:** SQLite (dev), PostgreSQL (prod) — use Prisma abstractions only
- **Migrations:** `npx prisma migrate dev --name description` for new changes
- **Transactions:** Use `prisma.$transaction()` for multi-step writes
- **courseCodes:** Stored as String (JSON-serialized) in SQLite. Always `JSON.parse()`/`JSON.stringify()` when reading/writing
- **No raw SQL** — always use Prisma client methods

### Prisma Models Quick Reference

| Model     | Key Fields                                              | Unique Constraints                |
| --------- | ------------------------------------------------------- | --------------------------------- |
| Lab       | name, labType                                           | name                              |
| Station   | labId, number, side                                     | (labId, number)                   |
| Cycle     | year, number, locked, courseCodes                       | name, (year, number)              |
| CycleWeek | cycleId, week, startDate, endDate                       | (cycleId, week)                   |
| Booking   | cycleId, stationId, shift, week, traineeName, contactId | (cycleId, stationId, shift, week) |

---

## Frontend Conventions (MUST FOLLOW)

### API Calls

- ALL API calls go through `api.js` — never use `axios` directly in components
- Base URL configured via Vite proxy (`/api` → `http://localhost:5001`)
- `axios.defaults.withCredentials = true` — cookies sent automatically
- 401 responses dispatch `auth:unauthorized` custom event → triggers re-auth check

### Routing

- React Router v6 with `createBrowserRouter` in `router.jsx`
- Routes: `/login` (standalone), `/schedule`, `/registration`, `/analytics` (wrapped in `AppLayout`)
- `AppLayout` handles auth guard, header, nav links (`NavLink`), CycleTabs, and `<Outlet />`
- URL is the source of truth for current view — no `currentView` state

### State Management

- **Zustand stores** for client state:
  - `authStore` — `authenticated` (null = loading, true/false = known)
  - `scheduleStore` — `activeCycleId`, `filters`, `searchCriteria`, `selectedCombination`, `reset()`
  - `themeStore` — `theme` ('light'|'dark'), `toggleTheme()`, `setTheme()` — drives DarkModeToggle, Sonner theme prop, chart reactivity
- **TanStack Query** for server state:
  - Query keys: `['cycles']`, `['grid', cycleId, shift, labType, side]`, `['contacts', ...]`, `['registration', cycleId, shift]`, `['seatingAnalytics', year, cycleId]`, `['registrationAnalytics', year, shift, cycleId]`
  - Mutations invalidate related query keys on success (e.g., `bookSlot` invalidates `['grid']`, `updateCourseCodes` invalidates `['registration']`)
  - `staleTime: 30s` default, `retry: 1` (configured in App.jsx `QueryClient`). Registration hooks use `staleTime: 60s` (HubSpot-backed)
- **Local state** for ephemeral UI (dialog state, search results, form inputs)

### Component Patterns

- Functional components with hooks only
- `App.jsx` is providers only (~17 lines): `QueryClientProvider` + `RouterProvider` + `Toaster` (theme from `themeStore`)
- `AppLayout.jsx` handles auth + chrome. `ScheduleView.jsx` handles grid/booking orchestration
- Dialogs render `null` when their trigger state is falsy
- Debounce search inputs (300ms for short queries, 100ms for pasted text)

### Forms

- React Hook Form + Zod for validation on: login, search criteria, booking, cell booking
- Schemas in `schemas/` directory. Use `zodResolver` with `useForm`
- Backend Joi validation is authoritative — Zod provides immediate UX feedback

### Styling

- Tailwind CSS utility classes only — no CSS modules, no inline styles
- **Semantic design system:** 49 CSS variables in `style.css` (`:root` light + `.dark` dark mode)
- All components use semantic tokens: `bg-card`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`, etc.
- **Zero hardcoded colors** in `src/components/` — all colors via CSS variable tokens
- Grid-specific tokens: `bg-grid-available`, `bg-grid-booked`, `bg-grid-selected`, etc.
- Chart colors: `chartTheme.js` reads `--chart-*` CSS variables → hex for Recharts
- Dark mode: `darkMode: 'class'` in Tailwind, Zustand `themeStore` for state, FOUC prevention in `index.html`
- Legacy `brand-*` palette still in config but not used in components
- Fonts: `Montserrat` (headings/sans), `Karla` (body)

---

## Testing

### Backend Tests

```bash
cd backend && npm test                          # all tests (--runInBand)
cd backend && npx jest --runInBand <pattern>    # single file by name match
```

- Framework: Jest + Supertest, with `ts-jest` transform (test files are `.test.js`, source is `.ts`)
- Test DB: `prisma/test.db` (created fresh per run via `globalSetup`/`globalTeardown`)
- Auth helper: `getAuthCookie()` from `__tests__/helpers.js`
- Pattern: one `describe` per endpoint group, `beforeAll` creates test data, `afterAll` cleans up

### Frontend Tests

```bash
cd frontend && npm test
```

- Framework: Vitest + @testing-library/react
- Environment: jsdom
- Setup: `src/__tests__/setup.js`

---

## Git Conventions

- Branch: `feature/short-desc`, `fix/short-desc`
- Commits: Conventional — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Never commit: `.env`, `*.db`, `node_modules/`, `dist/`, `coverage/`

---

## Best Practices (MUST FOLLOW)

### Express.js & Route Design

- **Routes are dumb adapters.** A route handler should be 5-10 lines max: parse request → call service → call `respond.*`. If a route is getting long, logic belongs in the service.
- **One router per domain.** Don't mix booking logic in the cycles router. Each domain (`cycles`, `bookings`, `grid`, `contacts`, `registration`, `analytics`) gets its own router file.
- **Always pass errors to `next(err)`.** Every async route handler must have `try/catch` with `catch (err) { next(err); }`. Never send error responses manually from routes — let `errorHandler` do it.
- **Middleware order matters.** Security middleware (Helmet, CORS, rate limiter) → parsing (JSON, cookies) → auth → validation → handler → error handler. Never rearrange this chain.
- **New middleware = add to `app.ts` only.** Don't apply middleware inside individual route files unless it's route-specific (like the HubSpot rate limiter).

### Prisma & Database

- **Always use `select` or `include` explicitly** on queries that return relations. Don't rely on Prisma's default eager loading — be explicit about what you fetch.

  ```js
  // Good
  prisma.cycle.findMany({ include: { cycleWeeks: true } });

  // Bad — fetches everything, unclear what relations come back
  prisma.cycle.findMany();
  ```

- **Use `findUnique` + null check before updates.** Don't let Prisma throw P2025 — check existence first and throw a descriptive `AppError(404)`.
  ```js
  const cycle = await prisma.cycle.findUnique({ where: { id } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');
  ```
- **Wrap related writes in `prisma.$transaction()`.** If you're doing 2+ writes that must succeed or fail together, always use a transaction. Single writes don't need transactions.
- **Name migrations descriptively.** `add_exam_date_to_booking` not `update_schema`. Migration names are permanent history.
- **Never modify an existing migration file.** Always create a new migration. Editing existing ones breaks deployed environments.
- **Avoid N+1 queries.** When fetching lists with relations, use `include` in the initial query — don't loop and query inside a `map/forEach`.

  ```js
  // Bad — N+1
  const cycles = await prisma.cycle.findMany();
  for (const c of cycles) {
    c.weeks = await prisma.cycleWeek.findMany({ where: { cycleId: c.id } });
  }

  // Good — single query
  const cycles = await prisma.cycle.findMany({ include: { cycleWeeks: true } });
  ```

### Joi Validation

- **One schema file per route file.** `schemas/cycles.js` maps to `routes/cycles.js`. Keep them in sync.
- **Use `.required()` explicitly** on fields that must be present. Joi defaults to optional — be explicit.
- **Add `.label('Human Readable Name')` to fields** so error messages say "Year is required" not "value is required".
  ```js
  year: Joi.number().integer().min(2020).max(2100).required().label('Year');
  ```
- **Custom validators for cross-field rules.** Use Joi's `.custom()` or schema-level `.and()`/`.or()` for rules like "endWeek must be >= startWeek".
- **Validate params and query separately.** Route params (`:id`) get `validate(idSchema, 'params')`. Query strings get `validate(filterSchema, 'query')`. Don't mix them into the body schema.

### Service Layer

- **Services own ALL business logic.** Validation is in middleware, HTTP parsing is in routes, DB access is in services. If you're writing an `if/else` business rule, it goes in a service.
- **Services throw, they don't return error objects.** Throw `AppError` — don't return `{ success: false, error: '...' }`.

  ```js
  // Good
  if (cycle.locked) throw new AppError(403, 'Cycle is locked.');

  // Bad
  if (cycle.locked) return { error: 'Cycle is locked.' };
  ```

- **Services are pure business logic — no `req`/`res` objects.** Pass only the data the service needs, not Express objects.

  ```js
  // Good
  bookingService.bookSlots({ cycleId, stationId, shift, weeks, traineeName });

  // Bad
  bookingService.bookSlots(req, res);
  ```

- **One service per domain.** `cycleService` handles cycles. Don't put booking logic in cycleService even if it touches cycles.

### HubSpot Integration

- **Always use batch APIs** when fetching multiple records. HubSpot's rate limit is 90 req/10sec — individual calls burn through it fast.
- **Cache aggressively.** Deal stage names rarely change (5 min cache). Registration lists are expensive to build (60 sec cache). Use the existing in-memory cache pattern.
- **Handle HubSpot being down gracefully.** If HubSpot API fails, the booking system should still work — HubSpot data is supplementary, not critical to core booking flow.
- **Never expose HubSpot API keys to the frontend.** All HubSpot calls go through the backend.
- **Log HubSpot API errors with context** (endpoint, params, response status) — these are the hardest to debug without context.

### React Components

- **Every component handles 3 states: Loading, Empty, Error.** Never show a blank screen. Show a spinner/skeleton while loading, a message when empty, and an error message on failure.
  ```jsx
  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (data.length === 0) return <EmptyState message="No cycles found." />;
  return <CycleList data={data} />;
  ```
- **Debounce user-triggered API calls.** Search inputs, filter changes — anything that fires on every keystroke must be debounced (300ms minimum).
- **Clean up effects.** Every `useEffect` that sets up a timer, listener, or subscription must return a cleanup function.
  ```jsx
  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query]);
  ```
- **Keep components under 200 lines.** If a component exceeds this, extract sub-components or custom hooks.
- **Colocate related state.** If `isLoading`, `error`, and `data` always change together, they belong in the same component/hook — don't scatter them across files.
- **Dialogs get their own component files.** Don't inline dialog JSX inside the parent — extract to `CellBookingDialog.jsx`, `StudentInfoDialog.jsx`, etc.

### Tailwind CSS Styling

- **Use Tailwind utilities only.** No `style={{ }}` inline styles, no CSS modules. If Tailwind doesn't have a utility, extend the config — don't write custom CSS.
- **Use semantic tokens, not raw colors.** `bg-primary`, `text-foreground`, `border-border` — never `bg-blue-500` or `text-gray-700`. All colors are defined as CSS variables in `style.css` and mapped in `tailwind.config.js`.
- **Responsive: mobile-first.** Write base styles for mobile, add `sm:`, `md:`, `lg:` for larger screens.
- **Group related utilities logically.** Layout → spacing → typography → colors → borders → effects.

  ```jsx
  // Good — semantic tokens
  className =
    'flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90';

  // Bad — hardcoded colors
  className =
    'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600';
  ```

- **Use consistent sizing.** Stick to Tailwind's spacing scale (`p-2`, `p-4`, `p-6`). Avoid arbitrary values like `p-[13px]` unless absolutely necessary.

### API Client (Frontend)

- **Centralized error handling.** The 401 interceptor in `api.js` handles auth expiry globally. Don't add auth checks in individual components.
- **API functions don't catch errors.** They throw on failure — TanStack Query catches errors and exposes them via `error` property. Only exceptions: `checkAuth()` (returns `false` on error), export functions (need blob handling).
- **Always extract `response.data.data`.** Backend wraps everything in `{ data, message }`. The API client should unwrap this so components get clean data.
- **Name API functions by what they do, not the HTTP method.** `fetchCycles()`, `bookSlot()`, `deleteBooking()` — not `getCycles()`, `postBooking()`, `deleteRequest()`.
- **Group related API functions together** in `api.js` with comments marking sections (Auth, Cycles, Bookings, Contacts, Registration, Analytics).
- **Use TanStack Query hooks** for data fetching — never `useEffect` + `fetch` in new code. Wrap API calls in `useQuery`/`useMutation` from the `hooks/` directory.

### Security

- **JWT tokens live in HttpOnly cookies only.** Never read or write tokens in JavaScript. The backend sets them, the browser sends them automatically.
- **Validate on both sides.** Backend validates with Joi (authoritative). Frontend validates for UX (immediate feedback). Backend is the single source of truth.
- **CORS is locked to specific origins.** When adding a new frontend URL (staging, preview deploys), add it to `ALLOWED_ORIGINS` in `.env` — don't wildcard.
- **Rate limits are per-route.** General routes: 300/15min. HubSpot proxy: 30/60sec. If adding a new expensive endpoint, consider adding a specific rate limiter.
- **Never log sensitive data.** Don't log passwords, tokens, API keys, or full HubSpot contact details. Log IDs and metadata only.
- **Sanitize all user-facing strings.** `traineeName` is already Joi-validated with a Unicode-safe regex. Apply the same pattern to any new user-input string fields.

### Performance

- **Keep HubSpot calls off the critical path.** Grid loading and booking should never wait for HubSpot. HubSpot data is fetched separately (contact search, registration list).
- **Use Prisma's `select` to fetch only needed fields** on queries that return large records. Don't fetch all 15 fields when you need 3.
  ```js
  // Good — fetch only what's needed for the list
  prisma.booking.findMany({
    where: { cycleId },
    select: { id: true, week: true, traineeName: true, stationId: true },
  });
  ```
- **CSV exports should stream for large datasets.** Current exports build full CSV in memory — acceptable for 133 stations × 12 weeks but watch for growth.
- **TanStack Query handles grid refetching.** Booking mutations invalidate `['grid']` automatically. Don't manually refetch — cache invalidation triggers it.

### Testing

- **Test the service layer, not the routes.** Routes are thin adapters — service functions are where bugs hide. Prioritize service tests.
- **Mock external APIs (HubSpot).** Never hit real HubSpot in tests. Mock `axios` responses for predictable, fast tests.
- **Each test creates its own data.** Don't rely on seed data or shared state between tests. `beforeEach` creates, `afterEach` cleans.
- **Test the sad path.** Test validation errors (400), not-found (404), conflicts (409), and locked cycles (403) — not just happy paths.
- **Name tests by behavior, not implementation.** `'returns 404 when cycle does not exist'` not `'calls findUnique and throws'`.

  ```js
  // Good
  test('returns 409 when slot is already booked', async () => { ... });

  // Bad
  test('bookSlots error handling', async () => { ... });
  ```

- **Frontend tests should test user interactions, not implementation.** Use `@testing-library/react` — click buttons, fill inputs, assert visible text. Don't test internal state.

### Code Organization

- **One export per file for services and schemas.** `cycleService.js` exports all cycle service functions. Don't split a single service across multiple files.
- **Keep related files close.** `routes/cycles.js` ↔ `schemas/cycles.js` ↔ `services/cycleService.js` — matching names make navigation instant.
- **Config values come from `config.js` only.** Never read `process.env` directly in services/routes. If a new env var is needed, add it to `config.js` first with a default value.
- **Dead code gets deleted, not commented.** Git history exists for a reason. Don't leave `// TODO: remove` or `// old implementation` blocks.

---

## Anti-Patterns (DO NOT DO)

1. **Don't bypass the service layer** — routes must NEVER call `prisma` directly
2. **Don't return raw data** — always use `respond.ok/list/created`
3. **Don't validate manually** — always use Joi schema + `validate()` middleware
4. **Don't swallow errors** — let them propagate to `errorHandler` via `next(err)`
5. **Don't hardcode secrets** — always use `config.js` which reads from `.env`
6. **Don't call HubSpot from routes/services** — go through `hubspot.js`
7. **Don't use `var`** — use `const` by default, `let` only when reassignment needed
8. **Don't add `console.log` for debugging** — remove before committing
9. **Don't modify Prisma migrations manually** — use `prisma migrate dev`
10. **Don't store JWT in localStorage** — it's in HttpOnly cookies

---

## Known Limitations

All 10 remediation phases are complete. Remaining limitations are intentional scope decisions:

- Frontend stays JavaScript (no TypeScript migration — backend only)
- Single admin password, no RBAC (single-user system by design)
- HubSpot calls are synchronous (Redis/BullMQ skipped — in-memory caching sufficient for single-instance)
- No pagination on list endpoints (`respond.paginated()` helper exists but not wired)
- SQLite in dev vs PostgreSQL in prod (behavioral differences possible)
- No E2E tests (Playwright deferred)
- No Sentry/error monitoring (deferred)
- `courseCodes` stored as JSON string in SQLite (needs proper array column on PostgreSQL migration)

See `REMEDIATION.md` for the complete 10-phase remediation plan (all phases complete).
