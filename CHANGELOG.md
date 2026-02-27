
# Changelog

## v2.5.0 — PDF Export for Analytics (2026-02-27)

Added one-click PDF export to the Analytics Dashboard. Captures all summary cards and charts as a multi-page A4 landscape report with filter metadata in the header.

### Modified Files

| File | What Changed |
|------|-------------|
| `frontend/src/components/AnalyticsDashboard.jsx` | PDF export button, `handleExportPDF` (html-to-image + jsPDF), frosted glass overlay, Escape-to-cancel, `data-pdf-hide` on interactive elements, `display: none` before capture, per-section capture with smart page breaks, canvas memory cleanup, named PDF constants |
| `frontend/src/App.jsx` | Added Sonner `<Toaster>` component for toast notifications |
| `frontend/package.json` | Added `html-to-image`, `jspdf`, `sonner` dependencies |

### How It Works

1. User clicks "Export PDF" → button disables, frosted overlay appears
2. `html-to-image` and `jspdf` are dynamically imported (not in initial bundle)
3. Interactive elements (lab/week filters, shift toggles) hidden via `display: none`
4. Each dashboard section (summary cards, chart rows, individual charts) captured as a separate canvas at 1.5x resolution
5. Sections placed into A4 landscape PDF with page breaks between sections — no chart is ever cut in half
6. PDF header: "Analytics Report", generation timestamp, active filters (year, cycle, shift)
7. Canvas memory released after each section (`canvas.width = 0`)
8. Hidden elements restored, overlay dismissed, success toast shown
9. Filename: `analytics-report-{year}-{cycle}-{HHmm}.pdf`

### Key Design Decisions

- **html-to-image over html2canvas**: Better SVG rendering for Recharts charts (uses foreignObject serialization)
- **Per-section capture over single canvas**: Prevents memory bombs on large dashboards, enables natural page breaks
- **PNG over JPEG**: Crisp chart lines and text without compression artifacts
- **Dynamic imports**: Zero impact on initial bundle size (~400KB combined loaded only on export click)
- **Escape-to-cancel**: `exportCancelledRef` checked after each section capture, skips `pdf.save()` if cancelled

---

## v2.4.0 — Analytics Dashboard (2026-02-25)

Added a full-page analytics dashboard that visualizes seating occupancy and registration data with interactive charts, multi-select filters, and AM/PM/Both shift toggle.

### New Files

| File | Purpose |
|------|---------|
| `backend/src/schemas/analytics.js` | Joi validation for analytics query params (year, cycleId, shift) |
| `backend/src/services/analyticsService.js` | Seating + registration analytics aggregation logic |
| `backend/src/routes/analytics.js` | Two GET endpoints: `/seating` and `/registration` |
| `frontend/src/components/AnalyticsDashboard.jsx` | Full analytics dashboard with Recharts visualizations |

### Modified Files

| File | What Changed |
|------|-------------|
| `backend/src/app.js` | Mounted analytics router on `/api/v1/analytics` |
| `frontend/package.json` | Added `recharts` dependency |
| `frontend/src/api.js` | Added `fetchSeatingAnalytics()` and `fetchRegistrationAnalytics()` |
| `frontend/src/App.jsx` | Analytics button in header, `currentView === 'analytics'` routing, hides CycleTabs/ViewToggle in analytics view |

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/analytics/seating?year=2026&cycleId=1` | Seating occupancy analytics with cross-tab matrix |
| GET | `/api/v1/analytics/registration?year=2026&shift=BOTH&cycleId=1` | Registration analytics (payment, cycle count, programs) |

### Seating Analytics Response

```json
{
  "data": {
    "weekOccupancy": [{ "week": 1, "totalSlots": 266, "booked": 140, "percent": 52.6 }],
    "labOccupancy": [{ "lab": "Lab A", "totalSlots": 912, "booked": 450, "percent": 49.3 }],
    "shiftOccupancy": [{ "shift": "AM", "totalSlots": 1596, "booked": 800, "percent": 50.1 }],
    "summary": { "totalSlots": 3192, "totalBooked": 1450, "overallPercent": 45.4, "numCycles": 1 },
    "bookingMatrix": { "Lab A": { "1": 20, "2": 15 } },
    "labStationCounts": { "Lab A": 38 }
  }
}
```

### Registration Analytics Response

```json
{
  "data": {
    "totalStudents": 85,
    "paymentDistribution": [{ "status": "Closed Won", "count": 60 }],
    "cycleCountDistribution": [{ "cycleNumber": 1, "count": 45 }],
    "programCounts": { "roadmap": 30, "afk": 12, "acj": 8 },
    "warnings": [{ "cycleId": 2, "cycleName": "Cycle 2", "shift": "AM", "error": "HubSpot API not configured" }]
  }
}
```

### Key Features

- **7 chart types:** Weekly occupancy (bar), Lab occupancy (bar), Shift comparison (bar), Payment status (pie), Program participation (horizontal bar), Cycle count distribution (bar)
- **4 summary cards:** Overall occupancy %, Total students, AM occupancy %, PM occupancy %
- **Cross-axis filtering:** Weekly chart filterable by labs, Lab chart filterable by weeks (multi-select dropdowns)
- **AM/PM/Both shift toggle:** Registration analytics supports combined view
- **Parallel HubSpot calls:** `Promise.allSettled` for multi-cycle fetch (4 cycles = ~2s instead of ~8s sequential)
- **Per-cycle warnings:** Failed cycles reported in response instead of silently dropped
- **Smart deduplication:** contactId-based with firstName+lastName fallback for null IDs
- **Backend cross-tab matrix:** `bookingMatrix` (lab × week) enables frontend-side filtering without extra API calls

---

## v2.3.0 — Backend Architecture Overhaul (2026-02-24)

Extracted service layer, added Joi schema validation, standardized API response envelope, added global error handler, and versioned all protected endpoints under `/api/v1/`.

### New Architecture

```
Routes (thin adapters) → Services (business logic) → Prisma (DB)
                        ↑                            ↑
              Joi validation middleware     AppError thrown on failures
                        ↓
              Global errorHandler catches all errors
```

### New Files

| File | Purpose |
|------|---------|
| `src/lib/AppError.js` | Custom error class with statusCode, message, details |
| `src/middleware/validate.js` | Joi validation middleware (bracket notation for array paths) |
| `src/middleware/errorHandler.js` | Global error handler — AppError + Prisma P2025/P2002/P2003 |
| `src/middleware/respond.js` | Response envelope helpers: `ok()`, `list()`, `created()` |
| `src/schemas/cycles.js` | Joi schemas for all cycle endpoints |
| `src/schemas/bookings.js` | Joi schemas for book/unbook/find/reset |
| `src/schemas/grid.js` | Joi schemas for grid + export |
| `src/schemas/contacts.js` | Joi schemas for contact search/details/payment |
| `src/schemas/registration.js` | Joi schemas for registration list + export |
| `src/services/cycleService.js` | Cycle CRUD business logic (create, lock, delete with transaction) |
| `src/services/bookingService.js` | Booking logic (book with P2002 race handling, unbook, find, reset) |
| `src/services/gridService.js` | Grid builder + CSV export (parallel DB queries) |
| `src/services/registrationService.js` | Registration list + CSV export from HubSpot |
| `__tests__/validation.test.js` | 7 tests for Joi validation + error handler |

### Modified Files

| File | What Changed |
|------|-------------|
| `src/app.js` | v1 Router groups all protected routes under `/api/v1/`, errorHandler mounted last |
| `src/hubspot.js` | Removed redundant `dotenv.config()`, uses `config.hubspotApiKey` |
| `src/routes/cycles.js` | Rewritten as thin adapter: validate → service → respond |
| `src/routes/bookings.js` | Rewritten as thin adapter with Joi validation |
| `src/routes/grid.js` | Rewritten as thin adapter, CSV stays without envelope |
| `src/routes/contacts.js` | Added Joi validation including payment status body |
| `src/routes/registration.js` | Full refactor: Joi params/query validation, service calls |
| `frontend/src/api.js` | All paths → `/api/v1/`, envelope unwrap (`res.data.data`), auth stays `/api/auth/` |

### API Response Envelope

All JSON responses now follow a standard envelope:

```json
// Success (single)
{ "data": { ... }, "message": "Success" }

// Success (list)
{ "data": [ ... ], "count": 42, "message": "Fetched" }

// Error
{ "error": "Validation failed.", "details": { "year": "year is required" } }
```

### API Versioning

- All protected routes moved to `/api/v1/` prefix
- Auth routes stay at `/api/auth/` (unversioned)
- Health check stays at `/api/health` (unversioned)

### Key Improvements

- **Transactions:** `deleteCycle` and `updateWeeks` wrapped in `prisma.$transaction()`
- **Race condition handling:** `bookSlots` catches Prisma P2002 (unique constraint) → friendly 409
- **Lock/unlock safety:** Checks cycle existence before update (404 instead of Prisma crash)
- **Grid parallel queries:** Station + cycle queries run via `Promise.all`
- **Cross-field validation:** `startWeek <= endWeek` enforced in Joi find schema

### Tests

18 backend tests pass (11 existing + 7 new validation tests). 6 frontend tests pass.

---

## v2.2.0 — Security Hardening (2026-02-24)

Added authentication, CORS lockdown, security headers, rate limiting, input sanitization, and error message leak fixes. All items from Remediation Plan Phase 1.

### New Files

| File | Purpose |
|------|---------|
| `src/middleware/auth.js` | JWT authentication via HttpOnly cookies (`requireAuth` middleware) |
| `src/routes/auth.js` | Login, logout, auth check endpoints (`/api/auth/*`) |
| `frontend/src/components/LoginPage.jsx` | Password login form with session persistence |

### Modified Files

| File | What Changed |
|------|-------------|
| `src/app.js` | Helmet, CORS with `ALLOWED_ORIGINS`, rate limiting (300/15min + 30/min HubSpot), cookie-parser, auth routes mounted |
| `src/config.js` | Added `jwtSecret`, `adminPasswordHash`, `nodeEnv`. Production env var validation with `process.exit(1)` |
| `frontend/src/config.js` | Removed `window.__API_BASE__` XSS vector |
| `frontend/src/App.jsx` | Added auth state, login page, 401 interceptor auto-logout |
| `frontend/src/api.js` | Added `login()`, `logout()`, `checkAuth()` functions |
| `.gitignore` | Added `*.db`, `*.db-shm`, `*.db-wal` |

### Security Measures

| Measure | Implementation |
|---------|---------------|
| Authentication | JWT in HttpOnly cookies, 8-hour expiry |
| CORS | Restricted to `ALLOWED_ORIGINS` env var (comma-separated) |
| Security Headers | Helmet middleware (CSP, HSTS, X-Frame-Options, etc.) |
| Rate Limiting | 300 req/15min general, 30 req/min on HubSpot contact search |
| Input Sanitization | traineeName regex + length validation, contact ID numeric check |
| Error Leaks | All `err.message` exposures replaced with generic messages |
| XSS Prevention | Removed `window.__API_BASE__` global injection point |
| Prod Validation | Missing `JWT_SECRET`/`DATABASE_URL` in production = process.exit(1) |

### New Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Prod only | Secret for signing JWT tokens |
| `ADMIN_PASSWORD` | Always | Admin login password (default: `admin123` for dev) |
| `ALLOWED_ORIGINS` | Prod only | Comma-separated allowed CORS origins |
| `NODE_ENV` | Prod only | Set to `production` for strict validation |

---

## v2.1.0 — Registration List (2026-02-23)

Added the Registration List feature (Part 2) — a per-cycle table showing all enrolled students pulled live from HubSpot, matched by course codes entered at cycle creation.

### Backend Changes

#### New Files
| File | Purpose |
|------|---------|
| `src/routes/registration.js` | Registration list JSON + CSV export endpoints |
| `prisma/migrations/..._add_course_codes_to_cycle/` | Adds `course_codes` column to cycles table |

#### Modified Files
| File | What Changed |
|------|-------------|
| `prisma/schema.prisma` | Added `courseCodes String? @map("course_codes")` to Cycle model |
| `src/app.js` | Mounted registration router on `/api/cycles` |
| `src/routes/cycles.js` | POST accepts `courseCodes` array, GET returns parsed codes, new `PATCH /:id/course-codes` endpoint |
| `src/hubspot.js` | Added batch association helpers (v4 API), `searchLineItemsByName`, `buildRegistrationList` orchestrator, rate limiter (90 req/10s), 60s registration cache |

#### New API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/api/cycles/:id/course-codes` | Update course codes for a cycle |
| GET | `/api/cycles/:id/registration?shift=AM` | Fetch registration list from HubSpot |
| GET | `/api/cycles/:id/registration/export?shift=AM` | Download registration list as CSV |

### Frontend Changes

#### New Files
| File | Purpose |
|------|---------|
| `components/RegistrationList.jsx` | Full registration table: AM/PM toggle, search/filter, refresh, CSV export, payment badges, edit course codes dialog |

#### Modified Files
| File | What Changed |
|------|-------------|
| `App.jsx` | Added view toggle (Seating Grid / Registration List), `currentView` state, `RegistrationList` rendering, `handleUpdateCourseCodes` handler |
| `components/CycleTabs.jsx` | Added course codes textarea to create cycle dialog |
| `api.js` | `createCycle` now sends `courseCodes`, added `fetchRegistrationList`, `exportRegistrationList`, `updateCourseCodes` |

### HubSpot Integration Details

**Data flow:** Course codes → search line items → batch get deal associations (v4) → batch read deals → batch get contact associations (v4) → batch read contacts → batch get history (all past deals + line items) → assemble rows.

**Properties used:**
| Column | HubSpot Property | Object |
|--------|-----------------|--------|
| Outstanding | `remaining_amount` | Deal |
| Course Start/End | `course_start_date` / `course_end_date` | Line Item |
| Registration Date | `createdate` | Deal |
| Student ID | `student_id` | Contact |
| Payment Status | `dealstage` → stage label | Deal |
| Cycle Count | Count of deals with "NDC" in line items | Deal history |
| Roadmap/AFK/ACJ | Line item name contains keyword | Deal history |

**Performance:** Uses HubSpot v4 batch association API to minimize API calls (~15-25 calls for 100+ students instead of 500+). 60-second cache per cycle+shift.

### Registration Table Columns (15)
Seat #, First Name, Last Name, Email, Phone, Student ID, Course Start, Course End, Registration Date, Payment Status, Outstanding, Cycle Count, Roadmap, AFK, ACJ

### Tests
All 12 existing tests pass (6 backend + 6 frontend) — zero regressions.

---

## v2.0.0 — Excel to Database + Cycle Management (2026-02-17)

Major rewrite: replaced Excel (Test.xlsx) with a proper database via Prisma ORM, added 12-week cycle management, and restructured the frontend into modular components.

### What Changed (Summary)

**Before:** Excel file (Test.xlsx) was the only data store. Parsed at runtime with `exceljs`. No cycles — just a flat sheet. Caching with `node-cache`/Redis. Microsoft Graph API for OneDrive sync.

**After:** SQLite database (Prisma ORM, PostgreSQL-ready for production). 12-week cycle system with lock/unlock. Modular frontend components. Full-width responsive grid.

---

### Backend Changes

#### New Files
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema: Lab, Station, Cycle, Booking models |
| `prisma/seed.js` | Seeds 6 labs with station counts, LH/RH sides, and initial cycle |
| `src/db.js` | Prisma client singleton |
| `src/hubspot.js` | HubSpot CRM service (moved from `api/backend/hubspot.js`) |
| `src/routes/cycles.js` | Cycle CRUD: list, create, lock, unlock |
| `.env.example` | Documents required environment variables |

#### Rewritten Files
| File | What Changed |
|------|-------------|
| `package.json` | Removed `exceljs`, `node-cache`, `redis`. Added `@prisma/client`, `prisma`. Version bumped to 2.0.0 |
| `src/index.js` | Mounts `/api/cycles` router. Removed `watchFile()` import. Added health check endpoint |
| `src/config.js` | Simplified to just `port`, `databaseUrl`, `hubspotApiKey`. Removed all Graph/OneDrive/Redis/cache config |
| `src/routes/availability.js` | Complete rewrite — all endpoints now use Prisma queries + require `cycleId`. Added cycle lock checking (403). Export changed from Excel to CSV. Added `side: ALL` support |
| `Dockerfile.dev` | Node 18 -> 20. Added `prisma generate` and `prisma migrate deploy` |
| `Dockerfile.prod` | Node 18 -> 20. Added `prisma generate` and `prisma migrate deploy` |

#### Deleted Files
| File | Reason |
|------|--------|
| `src/excel-loader.js` | Replaced by Prisma queries |
| `src/msgraph.js` | No OneDrive needed |
| `src/watch.js` | No file to watch |
| `src/cache.js` | Database queries are fast enough |
| `data/Test.xlsx` | No Excel |
| `excel.js` | Legacy |
| `auth.js` | Unused legacy auth |
| `auth/` directory | Unused legacy auth |
| `routes/graphRoutes.js` | Legacy Graph API routes |
| `test-download-url.js` | Legacy |
| `api/` directory (entire) | Duplicated backend for Vercel — deleted |

#### API Changes

**New endpoints:**
- `GET /api/cycles` — List all cycles
- `POST /api/cycles` — Create next cycle for year
- `PATCH /api/cycles/:id/lock` — Lock cycle
- `PATCH /api/cycles/:id/unlock` — Unlock cycle
- `GET /api/health` — Health check

**Modified endpoints (all now require `cycleId`):**

| Old Signature | New Signature |
|---------------|--------------|
| `POST /grid { lab, shift }` | `POST /grid { cycleId, shift, labType, side }` |
| `POST /book { lab, station, shift, weeks, traineeName }` | `POST /book { cycleId, stationId, shift, weeks, traineeName, contactId? }` |
| `POST /unbook { lab, station, shift, weeks }` | `POST /unbook { cycleId, stationId, shift, weeks }` |
| `POST /find { shift, startWeek, endWeek, weeksNeeded, level }` | `POST /find { cycleId, shift, labType, side, startWeek, endWeek, weeksNeeded }` |
| `POST /reset` (no body) | `POST /reset { cycleId }` |
| `GET /export` (downloads .xlsx) | `GET /export?cycleId=X` (downloads .csv) |

**Removed endpoints:**
- `POST /invalidate` — No cache to invalidate

**Unchanged endpoints:**
- `GET /contacts/search`
- `GET /contacts/:id`
- `PATCH /contacts/:id/payment-status`

---

### Frontend Changes

#### New Components (extracted from 1110-line `AvailabiltyFinder.jsx`)
| Component | Purpose |
|-----------|---------|
| `CycleTabs.jsx` | Chrome-style tabs with lock icon, "+" button to create cycles |
| `FilterBar.jsx` | Shift (AM/PM) + Lab Type (Regular/Pre-Exam) + Side (All/LH/RH) dropdowns |
| `SearchCriteriaForm.jsx` | Week range + consecutive weeks needed (level and stationType removed — now in FilterBar) |
| `BookingSection.jsx` | Contact search + trainee name + book button with locked-cycle awareness |
| `SearchResults.jsx` | Ranked availability results list |
| `AvailabilityGrid.jsx` | Full-width interactive grid with lab group headers, drag-select, search, always visible |
| `StudentInfoDialog.jsx` | Student info popup with HubSpot data and deals |
| `CellBookingDialog.jsx` | Modal for booking from grid cell click |

#### Rewritten Files
| File | What Changed |
|------|-------------|
| `App.jsx` | Complete rewrite as orchestrator. Layout: CycleTabs -> FilterBar -> [Search + Booking + Results] top row -> Full-width Grid below |
| `api.js` | All functions now take `cycleId`. Added `fetchCycles()`, `createCycle()`, `lockCycle()`, `unlockCycle()`, `exportCycle()`. Removed `invalidateCache()`, `exportExcel()`. Changed `fetchGrid()` signature from `(lab, shift)` to `(cycleId, shift, labType, side)` |

#### Deleted Files
| File | Reason |
|------|--------|
| `components/AvailabiltyFinder.jsx` | Split into 8 separate components above |

#### Unchanged Files
- `ContactSearch.jsx` — HubSpot search dropdown (kept as-is)
- `config.js` — API base URL config
- `main.jsx` — Entry point
- `style.css` — Tailwind imports

---

### Infrastructure Changes

| File | What Changed |
|------|-------------|
| `docker-compose.dev.yml` | Added `postgres:16-alpine` service with healthcheck, volume, `DATABASE_URL` env |
| `docker-compose.prod.yml` | Added `postgres:16-alpine` service, `DATABASE_URL`, `POSTGRES_PASSWORD` env var |
| `vercel.json` | Removed all `api/` route references (old serverless backend deleted) |
| `backend/.env.example` | New — documents `DATABASE_URL`, `PORT`, `HUBSPOT_API_KEY` |

---

### UI/Layout Changes

- **Cycle tabs** added at top of page (Chrome-style, right-click to lock/unlock)
- **Filter bar** below tabs: Shift, Lab Type, Side (with "All Stations" option)
- **Search + Booking + Results** moved to a horizontal row at top (3 equal columns)
- **Grid** is now full-width below, always visible (placeholder when no data)
- **Grid stations** formatted as `Lab A-1` instead of `Lab A - Station 1`
- **Grid groups** stations by lab name with separator rows
- **Locked cycles** show lock icon in tab, disable all booking/unbooking/reset buttons, grid is view-only
- **Export** changed from Excel (.xlsx) to CSV
- Page no longer constrained to `max-w-7xl` — uses full viewport width

---

### Database Schema

```
Labs         -> Stations (1:many, with LH/RH side)
Cycles       -> Bookings (1:many)
Stations     -> Bookings (1:many)
Booking unique: [cycleId, stationId, shift, week]
```

Currently using **SQLite** for local development. Schema is PostgreSQL-compatible — switch `provider` in `schema.prisma` and set `DATABASE_URL` for production.

---

### Pending TODOs
- [ ] Set up PostgreSQL on Neon and connect to Vercel deployment
- [ ] Switch `schema.prisma` from `sqlite` to `postgresql` for production
- [ ] Configure `DATABASE_URL` in Vercel environment variables
