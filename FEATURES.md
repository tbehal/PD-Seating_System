# Lab Availability Manager (SLAM) — Feature Reference

> Last updated: 2026-02-25

This document lists every feature in the application, which files implement it, which API endpoints power it, and which tests cover it. Use this as a map when working on the codebase.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS 3 |
| Backend | Express.js (Node 20) |
| ORM | Prisma |
| Database | SQLite (dev), PostgreSQL-ready (prod) |
| External API | HubSpot CRM (contact search, payment status) |
| Testing | Jest + Supertest (backend), Vitest + Testing Library (frontend) |
| Validation | Joi (backend) | Schema-first request validation |
| Auth | JWT + HttpOnly cookies | Password-based admin login |

---

## Project Structure

```
backend/
  src/
    app.js              # Express app — v1 router, middleware, error handler
    index.js            # Entry point — imports app, starts server
    config.js           # Environment config (PORT, DATABASE_URL, HUBSPOT_API_KEY, JWT_SECRET)
    db.js               # Prisma client singleton
    hubspot.js          # HubSpot CRM service (contact search + registration list builder)
    lib/
      AppError.js       # Custom error class (statusCode, message, details)
    middleware/
      auth.js           # JWT authentication (requireAuth, cookie-based)
      validate.js       # Joi schema validation middleware
      errorHandler.js   # Global error handler (AppError + Prisma errors)
      respond.js        # Response envelope helpers (ok, list, created)
    schemas/
      cycles.js         # Joi schemas for cycle endpoints
      bookings.js       # Joi schemas for booking endpoints
      grid.js           # Joi schemas for grid + export
      contacts.js       # Joi schemas for contact endpoints
      registration.js   # Joi schemas for registration endpoints
      analytics.js      # Joi schemas for analytics endpoints
    services/
      cycleService.js   # Cycle CRUD business logic
      bookingService.js # Booking logic (book, unbook, find, reset)
      gridService.js    # Grid builder + CSV export
      registrationService.js # Registration list from HubSpot
      analyticsService.js # Seating + registration analytics aggregation
    routes/
      auth.js           # Login, logout, auth check (/api/auth/*)
      cycles.js         # Cycle CRUD (thin adapter → cycleService)
      grid.js           # Grid + export (thin adapter → gridService)
      bookings.js       # Book/unbook/find/reset (thin adapter → bookingService)
      contacts.js       # HubSpot contact endpoints
      registration.js   # Registration list + CSV export
      analytics.js       # Analytics dashboard endpoints (seating + registration)
  prisma/
    schema.prisma       # Database schema
    seed.js             # Seeds 6 labs, 133 stations, initial cycle
    migrations/         # Prisma migration history
  __tests__/
    setup.js            # Global test setup
    teardown.js         # Global test teardown
    env-setup.js        # Sets DATABASE_URL for test worker
    cycles.test.js      # 4 tests for cycle endpoints
    availability.test.js # 2 tests for grid + export
    auth.test.js        # 5 tests for authentication
    validation.test.js  # 7 tests for Joi validation + error handler

frontend/
  src/
    App.jsx             # Main orchestrator — auth state, view routing
    api.js              # All API call functions (envelope unwrap)
    config.js           # API_BASE URL (no window global)
    components/
      LoginPage.jsx         # Admin login form
      CycleTabs.jsx         # Cycle tab bar with +/x/lock
      FilterBar.jsx         # Shift, Lab Type, Side dropdowns
      SearchCriteriaForm.jsx # Week range + weeks needed inputs
      BookingSection.jsx     # Trainee name + contact search + book button
      SearchResults.jsx      # Ranked availability results list
      AvailabilityGrid.jsx   # Interactive grid with drag-select
      StudentInfoDialog.jsx  # Student info popup with HubSpot data
      CellBookingDialog.jsx  # Modal for booking from grid cell click
      ContactSearch.jsx      # HubSpot contact search dropdown
      RegistrationList.jsx   # Registration list table (live HubSpot data)
      AnalyticsDashboard.jsx # Analytics dashboard with charts (Recharts)
    __tests__/
      setup.js                   # Imports jest-dom matchers
      AvailabilityGrid.test.jsx  # 6 tests for grid component
```

---

## Features

### 0. Authentication

All API endpoints (except health check) require authentication. Admin logs in with a password, receives a JWT token stored in an HttpOnly cookie.

| Action | UI | API Endpoint | Backend File | Frontend File |
|--------|-----|-------------|-------------|---------------|
| Login | Enter password, click Login | `POST /api/auth/login` | `routes/auth.js` | `LoginPage.jsx` |
| Logout | Click Logout button | `POST /api/auth/logout` | `routes/auth.js` | `App.jsx` |
| Session check | Auto-check on page load | `GET /api/auth/check` | `routes/auth.js` | `App.jsx` |

**Security measures:**
- JWT stored in HttpOnly cookie (not accessible via JavaScript)
- 8-hour token expiry
- 401 responses trigger automatic logout via axios interceptor
- CORS restricted to allowed origins only
- Helmet security headers on all responses
- Rate limiting: 300 req/15min general, 30 req/min on contact search

---

### 1. Cycle Management

Cycles represent 12-week scheduling periods (e.g., "Cycle 1 - 2026").

| Action | UI | API Endpoint | Backend File | Frontend File |
|--------|-----|-------------|-------------|---------------|
| List cycles | Tab bar loads on page mount | `GET /api/v1/cycles` | `routes/cycles.js` | `CycleTabs.jsx` |
| Create cycle | Click "+" button, enter year + optional course codes | `POST /api/v1/cycles` | `routes/cycles.js` | `CycleTabs.jsx` |
| Delete cycle | Click "x" on tab, confirm dialog | `DELETE /api/v1/cycles/:id` | `routes/cycles.js` | `CycleTabs.jsx` |
| Lock cycle | Right-click tab | `PATCH /api/v1/cycles/:id/lock` | `routes/cycles.js` | `CycleTabs.jsx` |
| Unlock cycle | Right-click locked tab | `PATCH /api/v1/cycles/:id/unlock` | `routes/cycles.js` | `CycleTabs.jsx` |
| Switch cycle | Click tab | (frontend only) | — | `App.jsx` |

| Edit course codes | "Edit Course Codes" button in Registration List | `PATCH /api/v1/cycles/:id/course-codes` | `routes/cycles.js` | `RegistrationList.jsx` |

**Business rules:**
- Creating a cycle auto-generates 12 CycleWeek records (week 1-12) with null dates
- Optional course codes can be set at creation or edited later (JSON array stored as text)
- Deleting a cycle cascades: removes all bookings + week records for that cycle
- Locked cycles block all booking/unbooking/reset/week-date edits (403)
- Delete confirmation dialog: "Are you sure you want to delete [Cycle Name]?"

**Tests:** `backend/__tests__/cycles.test.js` (4 tests)

---

### 2. Cycle Week Dates

Each week in a cycle can have optional start/end dates displayed in the grid headers.

| Action | UI | API Endpoint | Backend File | Frontend File |
|--------|-----|-------------|-------------|---------------|
| View week dates | Grid headers show "W1 (Jan 6-Jan 10)" | (included in grid response) | `routes/grid.js` | `AvailabilityGrid.jsx` |
| Edit week dates | Click week header, popover with date inputs | `PATCH /api/v1/cycles/:id/weeks` | `routes/cycles.js` | `AvailabilityGrid.jsx` |

**Business rules:**
- Week numbers must be 1-12
- Start date must be <= end date (400 error otherwise)
- Cannot edit dates on locked cycles (403)
- Null dates are allowed (header shows "W1" without subtitle)

**Tests:** `backend/__tests__/cycles.test.js` (covered in PATCH tests), `frontend/src/__tests__/AvailabilityGrid.test.jsx` (6 tests)

---

### 3. Availability Grid

The main UI: a table showing stations as rows and weeks 1-12 as columns.

| Action | UI | API Endpoint | Backend File | Frontend File |
|--------|-----|-------------|-------------|---------------|
| Load grid | Auto-loads when cycle/filters change | `POST /api/v1/availability/grid` | `routes/grid.js` | `App.jsx` → `AvailabilityGrid.jsx` |
| Filter grid | Shift (AM/PM), Lab Type (Regular/Pre-Exam), Side (All/LH/RH) | (filters sent with grid request) | `routes/grid.js` | `FilterBar.jsx` |
| Search in grid | Text input filters rows by trainee name | (frontend only) | — | `AvailabilityGrid.jsx` |

**Grid cell values:**
- `✓` = available (green)
- Trainee name = booked (red, underlined, clickable)
- `✗` = unavailable (gray)

**Behavior:**
- Stations grouped by lab name with separator rows
- Columns are fixed-width (100px), rows alternate white/gray
- Grid is always visible below the search/booking section
- Locked cycles show "(Read-only)" badge, disable booking interactions

**Tests:** `backend/__tests__/availability.test.js` (grid test), `frontend/src/__tests__/AvailabilityGrid.test.jsx` (6 tests)

---

### 4. Booking & Unbooking

Users can book/unbook stations for trainees via two methods: search-based or grid-click.

#### 4a. Search-Based Booking (left panel)

| Action | UI | API Endpoint | Backend File | Frontend File |
|--------|-----|-------------|-------------|---------------|
| Find available slots | Enter week range + weeks needed, click Search | `POST /api/v1/availability/find` | `routes/bookings.js` | `SearchCriteriaForm.jsx` |
| View results | Ranked list of available station+week combos | (frontend only) | — | `SearchResults.jsx` |
| Book from results | Select combo, enter name, click Book | `POST /api/v1/availability/book` | `routes/bookings.js` | `BookingSection.jsx` |

#### 4b. Grid-Click Booking (direct)

| Action | UI | API Endpoint | Backend File | Frontend File |
|--------|-----|-------------|-------------|---------------|
| Book from grid | Click available cell(s), enter name in dialog | `POST /api/v1/availability/book` | `routes/bookings.js` | `CellBookingDialog.jsx` |
| Unbook from grid | Drag-select booked cells, click "Clear Selected" | `POST /api/v1/availability/unbook` | `routes/bookings.js` | `AvailabilityGrid.jsx` |
| View booked info | Single-click booked cell | (frontend only) | — | `StudentInfoDialog.jsx` |
| Reset all bookings | Click "Clear All" button, confirm | `POST /api/v1/availability/reset` | `routes/bookings.js` | `AvailabilityGrid.jsx` |

**Drag-select behavior:**
- Mouse-down on a cell starts selection mode (book or unbook based on cell state)
- Drag horizontally across same station to select multiple weeks
- Selection toolbar shows count + Confirm/Cancel buttons
- Single-click on booked cell opens student info (no drag)

**Business rules:**
- Booking checks for conflicts (409 if already booked)
- All booking operations blocked on locked cycles (403)
- Trainee name is trimmed before saving
- Optional HubSpot contact ID can be attached to booking

---

### 5. CSV Export

Exports the current grid view as a downloadable CSV file.

| Action | UI | API Endpoint | Backend File | Frontend File |
|--------|-----|-------------|-------------|---------------|
| Export | Click "Export CSV" button | `GET /api/v1/availability/export?cycleId=X&shift=AM&labType=REGULAR&side=ALL` | `routes/grid.js` | `App.jsx` → `api.js` |

**CSV format** (mirrors the grid layout):
```
Station,W1 (Jan 6-Jan 10),W2,W3,...,W12
Lab A-1,✓,John Doe,✓,...,✓
Lab A-2,Test Student,✓,✓,...,✓
```

- Column headers include date ranges when week dates are set
- Cell values: trainee name (quoted if contains commas) or ✓
- Respects current filters (shift, labType, side)
- Filename: `cycle-{id}-{shift}-{labType}-export.csv`

**Tests:** `backend/__tests__/availability.test.js` (export test)

---

### 6. HubSpot Integration

Contact lookup and payment status tracking via HubSpot CRM API.

| Action | UI | API Endpoint | Backend File | Frontend File |
|--------|-----|-------------|-------------|---------------|
| Search contacts | Type in contact search field | `GET /api/v1/availability/contacts/search?q=X` | `routes/contacts.js` | `ContactSearch.jsx` |
| Get contact details | Auto-fetched when viewing booked cell | `GET /api/v1/availability/contacts/:id` | `routes/contacts.js` | `StudentInfoDialog.jsx` |
| Update payment status | (from student info dialog) | `PATCH /api/v1/availability/contacts/:id/payment-status` | `routes/contacts.js` | `StudentInfoDialog.jsx` |
| Auto-match by name | When clicking booked cell, searches HubSpot by trainee name | (uses search endpoint) | `routes/contacts.js` | `App.jsx` |

**Notes:**
- Requires `HUBSPOT_API_KEY` in backend `.env`
- Contact search tries exact match first, then partial match, then first result
- Used during booking (optional) and student info viewing (automatic)

---

### 7. Registration List

Per-cycle table showing all enrolled students, pulled live from HubSpot by matching course codes against line item names. Accessed via the "Registration List" view toggle in the main UI.

| Action | UI | API Endpoint | Backend File | Frontend File |
|--------|-----|-------------|-------------|---------------|
| View toggle | Click "Seating Grid" / "Registration List" tabs | (frontend only) | — | `App.jsx` |
| Load registration | Auto-loads when cycle/shift changes | `GET /api/v1/cycles/:id/registration?shift=AM` | `routes/registration.js` | `RegistrationList.jsx` |
| Switch shift | Click AM/PM toggle | (changes query param) | `routes/registration.js` | `RegistrationList.jsx` |
| Search/filter | Type in search bar | (frontend only) | — | `RegistrationList.jsx` |
| Refresh | Click "Refresh" button | `GET ...?refresh=true` | `routes/registration.js` | `RegistrationList.jsx` |
| Export CSV | Click "Export CSV" button | `GET /api/v1/cycles/:id/registration/export?shift=AM` | `routes/registration.js` | `RegistrationList.jsx` |
| Edit course codes | Click "Edit Course Codes", update in dialog | `PATCH /api/v1/cycles/:id/course-codes` | `routes/cycles.js` | `RegistrationList.jsx` |

**Table columns (15):**

| # | Column | Source | Notes |
|---|--------|--------|-------|
| 1 | Seat # | Auto-increment | Sorted by registration date ASC |
| 2 | First Name | Contact `firstname` | |
| 3 | Last Name | Contact `lastname` | |
| 4 | Email | Contact `email` | |
| 5 | Phone | Contact `phone` | |
| 6 | Student ID | Contact `student_id` | |
| 7 | Course Start | Line Item `course_start_date` | |
| 8 | Course End | Line Item `course_end_date` | |
| 9 | Reg. Date | Deal `createdate` | |
| 10 | Payment Status | Deal `dealstage` → label | Color-coded badge (green/yellow/red) |
| 11 | Outstanding | Deal `remaining_amount` | Red text if > 0 |
| 12 | Cycle # | Computed | Count of past deals with "NDC" in line items |
| 13 | Roadmap | Computed | Yes (green) / No (gray) — any past line item contains "ROADMAP" |
| 14 | AFK | Computed | Yes (green) / No (gray) — any past line item contains "AFK" |
| 15 | ACJ | Computed | Yes (green) / No (gray) — any past line item contains "ACJ" |

**Data flow:**
1. Search line items by course code (`CONTAINS_TOKEN` on `name`)
2. Batch get deal associations (v4 API, 100 per call)
3. Batch read deal details (`remaining_amount`, `createdate`, `dealstage`, `pipeline`)
4. Batch get contact associations (v4 API)
5. Batch read contact details (`firstname`, `lastname`, `email`, `student_id`, `phone`)
6. Batch get all historical deals per contact → batch read deal names → batch get line items → detect NDC/Roadmap/AFK/ACJ
7. Resolve deal stage names (cached), sort by `createdate` ASC, assign seat numbers

**Course codes:**
- Admin enters multiple codes per cycle (one per line), e.g. `NDC-26-Mis1-Clinical-AM`, `NDC-26-Mis1-Clinical-PM`
- AM/PM shift filtering: codes containing "AM"/"PM" are auto-filtered by selected shift
- If no shift-specific codes found, all codes are used as fallback

**Performance:**
- Uses HubSpot v4 batch association API (~15-25 API calls for 100+ students)
- 60-second TTL cache keyed by `cycleId_shift`
- Rate limiter: 90 requests per 10-second window

**Error states:**
- No API key → 503 with message
- Rate limited → 429 with retry message
- No course codes → "No course codes configured" with edit prompt
- No students found → empty state message

---

### 8. Analytics Dashboard

Full-page analytics dashboard accessible via the "Analytics" button in the header. Visualizes seating occupancy (from DB bookings) and registration data (from HubSpot) with interactive charts.

| Action | UI | API Endpoint | Backend File | Frontend File |
|--------|-----|-------------|-------------|---------------|
| Open analytics | Click "Analytics" button in header | — | — | `App.jsx` |
| View seating stats | Auto-loads when year/cycle changes | `GET /api/v1/analytics/seating?year=2026&cycleId=1` | `routes/analytics.js` | `AnalyticsDashboard.jsx` |
| View registration stats | Auto-loads when year/cycle/shift changes | `GET /api/v1/analytics/registration?year=2026&shift=AM` | `routes/analytics.js` | `AnalyticsDashboard.jsx` |
| Filter by year | Year dropdown | (changes query param) | — | `AnalyticsDashboard.jsx` |
| Filter by cycle | Cycle dropdown ("All Cycles" or specific) | (changes query param) | — | `AnalyticsDashboard.jsx` |
| Switch shift | AM / PM / Both toggle | (changes query param) | — | `AnalyticsDashboard.jsx` |
| Filter weekly chart by labs | Multi-select lab dropdown on chart | (frontend only) | — | `AnalyticsDashboard.jsx` |
| Filter lab chart by weeks | Multi-select week dropdown on chart | (frontend only) | — | `AnalyticsDashboard.jsx` |
| Back to grid | Click "Back" button | — | — | `AnalyticsDashboard.jsx` |
| Export PDF | Click "Export PDF" button | (frontend only) | — | `AnalyticsDashboard.jsx` |

**PDF Export:**
- Captures all summary cards + charts as a multi-page A4 landscape PDF
- Uses `html-to-image` (per-section capture) + `jsPDF` — both dynamically imported on click (zero bundle impact)
- PDF header includes: report title, generation timestamp, active filter values (year, cycle, shift)
- Interactive elements (lab/week filters, shift toggles) are hidden from capture via `data-pdf-hide` + `display: none`
- Smart page breaks: each dashboard section captured individually, new page only between sections (never cuts a chart in half)
- Cancel support: press Escape during export to abort
- Feedback: Sonner toasts for success/error, frosted glass overlay during capture
- Controls (Back, Year, Cycle selects) disabled during export to prevent race conditions
- Canvas memory released after each section capture

**Summary Cards (4):**
- Overall Occupancy % (seating)
- Total Students (registration)
- AM Occupancy % (seating)
- PM Occupancy % (seating)

**Charts (7):**

| Chart | Type | Data Source | Filter |
|-------|------|------------|--------|
| Weekly Occupancy | Bar | Seating (DB) | Multi-select labs |
| Lab Occupancy | Bar | Seating (DB) | Multi-select weeks |
| Shift Comparison | Bar | Seating (DB) | — |
| Payment Status | Pie | Registration (HubSpot) | Shift toggle |
| Program Participation | Horizontal Bar | Registration (HubSpot) | Shift toggle |
| Cycle Count Distribution | Bar | Registration (HubSpot) | Shift toggle |

**Cross-axis filtering:**
- Backend returns a `bookingMatrix` (lab × week cross-tabulation) alongside pre-aggregated data
- Frontend recomputes occupancy percentages client-side when filters are applied
- "All" selected = uses pre-aggregated data (no recalculation)

**Seating analytics aggregation:**
- Resolves cycles for the year (or single cycle if specified)
- Fetches all stations with lab info + all bookings for those cycles
- Computes: weekOccupancy (12 weeks), labOccupancy (per lab), shiftOccupancy (AM/PM), summary

**Registration analytics aggregation:**
- Calls `registrationService.getRegistrationList` for each cycle in scope (parallel via `Promise.allSettled`)
- Supports `BOTH` shift: fetches AM + PM and merges
- Deduplicates by contactId (fallback: firstName + lastName)
- Returns warnings for failed cycles (e.g., HubSpot down) instead of silently dropping
- Computes: totalStudents, paymentDistribution, cycleCountDistribution, programCounts

**Dependencies:** `recharts` (charting), `html-to-image` (DOM-to-canvas), `jspdf` (PDF generation), `sonner` (toast notifications)

---

## Architecture (Phase 2)

**Request flow:** Client → Auth middleware → Joi validation → Route (thin adapter) → Service (business logic) → Prisma → DB

**Error flow:** Service throws `AppError(statusCode, message)` → Global `errorHandler` catches → Formatted JSON response

**Response envelope:** All JSON responses wrapped in `{ data, message }` or `{ data, count, message }` for lists. Errors return `{ error, details? }`.

---

## Database Schema

```
Lab (id, name, labType)
  └── Station (id, labId, number, side)
        └── Booking (id, cycleId, stationId, shift, week, traineeName, contactId?, bookedAt)

Cycle (id, name, year, number, locked, courseCodes?, createdAt)
  ├── CycleWeek (id, cycleId, week, startDate?, endDate?)
  └── Booking (via cycleId)
```

**Unique constraints:**
- `Lab.name`
- `Station.[labId, number]`
- `Cycle.[year, number]`
- `CycleWeek.[cycleId, week]`
- `Booking.[cycleId, stationId, shift, week]`

**Seed data:** 6 labs (A, B, C, E = Regular; B9, D = Pre-Exam), 133 total stations with LH/RH sides.

---

## API Endpoints Summary

### Auth (`/api/auth`) — `routes/auth.js`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with admin password, sets JWT cookie |
| POST | `/api/auth/logout` | Clears JWT cookie |
| GET | `/api/auth/check` | Verify current session |

### Cycles (`/api/v1/cycles`) — `routes/cycles.js`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/cycles` | List all cycles with cycleWeeks + parsed courseCodes |
| POST | `/api/v1/cycles` | Create next cycle for year (auto-creates 12 CycleWeeks, optional courseCodes) |
| PATCH | `/api/v1/cycles/:id/weeks` | Update week start/end dates |
| PATCH | `/api/v1/cycles/:id/course-codes` | Update course codes for a cycle |
| PATCH | `/api/v1/cycles/:id/lock` | Lock cycle |
| PATCH | `/api/v1/cycles/:id/unlock` | Unlock cycle |
| DELETE | `/api/v1/cycles/:id` | Delete cycle + all bookings + week records |

### Registration (`/api/v1/cycles`) — `routes/registration.js`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/cycles/:id/registration?shift=AM&refresh=true` | Fetch registration list from HubSpot |
| GET | `/api/v1/cycles/:id/registration/export?shift=AM` | Download registration list as CSV |

### Grid (`/api/v1/availability`) — `routes/grid.js`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/availability/grid` | Build 12-week availability grid |
| GET | `/api/v1/availability/export` | Download grid-format CSV |

### Bookings (`/api/v1/availability`) — `routes/bookings.js`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/availability/book` | Book station(s) for a trainee |
| POST | `/api/v1/availability/unbook` | Remove booking(s) |
| POST | `/api/v1/availability/find` | Find consecutive available week blocks |
| POST | `/api/v1/availability/reset` | Delete all bookings for a cycle |

### Contacts (`/api/v1/availability`) — `routes/contacts.js`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/availability/contacts/search` | Search HubSpot contacts |
| GET | `/api/v1/availability/contacts/:id` | Get contact by ID |
| PATCH | `/api/v1/availability/contacts/:id/payment-status` | Update payment status |

### Analytics (`/api/v1/analytics`) — `routes/analytics.js`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/analytics/seating?year=2026&cycleId=1` | Seating occupancy analytics (week, lab, shift breakdown + cross-tab matrix) |
| GET | `/api/v1/analytics/registration?year=2026&shift=AM&cycleId=1` | Registration analytics (payment, cycle count, programs). Shift: AM/PM/BOTH |

---

## Test Coverage

### Backend (Jest + Supertest) — `npm test` in `backend/`

| Test File | Tests | What's Covered |
|-----------|-------|---------------|
| `cycles.test.js` | 4 | Create cycle, list cycles, upsert week dates, validation |
| `availability.test.js` | 2 | Grid includes weekDates array with dates, export CSV format |
| `auth.test.js` | 5 | Login success/fail, auth check, protected route 401, logout |
| `validation.test.js` | 7 | Missing fields, invalid types, bad shift, envelope format, nonexistent cycle, missing grid fields |

### Frontend (Vitest + Testing Library) — `npm test` in `frontend/`

| Test File | Tests | What's Covered |
|-----------|-------|---------------|
| `AvailabilityGrid.test.jsx` | 6 | Week label without dates, week label with date range, popover opens when unlocked, popover blocked when locked, popover has correct inputs/buttons, save calls onUpdateWeekDates with correct args |

---

## Running the App

```bash
# Backend
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev                    # http://localhost:5001

# Frontend
cd frontend
npm install
npm start                      # http://localhost:5173

# Tests
cd backend && npm test         # 18 backend tests
cd frontend && npm test        # 6 frontend tests
```

---

## Environment Variables

```env
# backend/.env
PORT=5001
DATABASE_URL=file:./dev.db     # SQLite for dev; PostgreSQL URL for prod
HUBSPOT_API_KEY=pat-na1-...    # HubSpot private app token
JWT_SECRET=your-secret-here    # Required in production
ADMIN_PASSWORD=admin123        # Admin login password
ALLOWED_ORIGINS=http://localhost:5173  # Comma-separated, required in production
NODE_ENV=development           # Set to "production" for strict env validation
```
