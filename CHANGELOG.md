
# Changelog

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
