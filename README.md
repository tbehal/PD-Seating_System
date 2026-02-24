
# Smart Lab Availability Manager (NDECC Scheduler)

A scheduling system for booking lab stations across 12-week cycles. Supports multiple labs, shifts (AM/PM), and HubSpot CRM integration.

## Architecture

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite + Tailwind CSS 3 | SPA at port 5173 |
| Backend | Express.js + Prisma ORM | REST API at port 5001 |
| Database | SQLite (dev) / PostgreSQL (prod) | Prisma manages migrations |
| CRM | HubSpot API | Optional — contact search & deal lookup |

## Data Model

- **Labs**: Lab A, B, C, E (Regular) and Lab B9, D (Pre-Exam)
- **Stations**: Each lab has numbered stations with LH/RH side designation
- **Cycles**: 12-week scheduling periods (e.g. "Cycle 1 - 2026"), lockable
- **Bookings**: Trainee name + optional HubSpot contact per station/shift/week

## Local Setup (Without Docker)

```sh
# 1. Backend
cd backend
npm install
npx prisma migrate dev --name init   # Creates SQLite DB + seeds data
npm run dev                           # Starts on http://localhost:5001

# 2. Frontend (new terminal)
cd frontend
npm install
npm start                             # Starts on http://localhost:5173
```

## Running with Docker

### Development (with hot-reloading)

```sh
docker compose -f docker-compose.dev.yml up --build
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5001
- **PostgreSQL:** localhost:5432 (user: ndecc, db: ndecc_sched)

### Production

```sh
docker compose -f docker-compose.prod.yml up --build -d
```

- App available at http://localhost (port 80)
- Backend at port 5001
- PostgreSQL with persistent volume

### Stopping

```sh
docker compose -f docker-compose.dev.yml down    # dev
docker compose -f docker-compose.prod.yml down   # prod
```

## API Endpoints

### Cycles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cycles` | List all cycles (newest first) |
| POST | `/api/cycles` | Create next cycle `{ year }` |
| PATCH | `/api/cycles/:id/lock` | Lock a cycle (read-only) |
| PATCH | `/api/cycles/:id/unlock` | Unlock a cycle |

### Availability

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/availability/grid` | Get 12-week grid `{ cycleId, shift, labType, side }` |
| POST | `/api/availability/book` | Book station `{ cycleId, stationId, shift, weeks[], traineeName }` |
| POST | `/api/availability/unbook` | Remove booking `{ cycleId, stationId, shift, weeks[] }` |
| POST | `/api/availability/find` | Find consecutive available blocks `{ cycleId, shift, labType, side, startWeek, endWeek, weeksNeeded }` |
| POST | `/api/availability/reset` | Clear all bookings for cycle `{ cycleId }` |
| GET | `/api/availability/export?cycleId=X` | Export cycle as CSV |

### HubSpot Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/availability/contacts/search?q=name` | Search contacts |
| GET | `/api/availability/contacts/:id` | Get contact by ID |
| PATCH | `/api/availability/contacts/:id/payment-status` | Update payment status |

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=file:./dev.db              # SQLite for dev (auto-configured)
PORT=5001
HUBSPOT_API_KEY=                        # Optional: HubSpot Private App token
```

### Frontend

```env
VITE_API_BASE=http://localhost:5001     # Set in docker-compose or .env
```

## Project Structure

```
backend/
  prisma/
    schema.prisma       # Database schema (Lab, Station, Cycle, Booking)
    seed.js             # Seeds labs, stations, initial cycle
    dev.db              # SQLite database (gitignored)
  src/
    index.js            # Express app entry point
    config.js           # Environment config
    db.js               # Prisma client singleton
    hubspot.js          # HubSpot CRM service
    routes/
      availability.js   # Grid, book, unbook, find, reset, export + HubSpot routes
      cycles.js         # Cycle CRUD + lock/unlock

frontend/
  src/
    App.jsx             # Main orchestrator
    api.js              # All API client functions
    config.js           # API base URL config
    components/
      CycleTabs.jsx         # Chrome-style cycle tabs with lock/create
      FilterBar.jsx         # Shift / Lab Type / Side dropdowns
      SearchCriteriaForm.jsx # Week range + consecutive weeks search
      BookingSection.jsx     # Contact search + booking form
      SearchResults.jsx      # Ranked availability results
      AvailabilityGrid.jsx   # Full-width interactive grid with drag-select
      StudentInfoDialog.jsx  # Student info popup with HubSpot data
      CellBookingDialog.jsx  # Grid cell booking modal
      ContactSearch.jsx      # HubSpot contact search dropdown
```

## Seed Data

| Lab | Type | Stations | LH Stations |
|-----|------|----------|-------------|
| Lab A | Regular | 38 | 1, 38 |
| Lab B | Regular | 31 | 25 |
| Lab C | Regular | 14 | 7 |
| Lab E | Regular | 15 | 14 |
| Lab B9 | Pre-Exam | 20 | 10, 11 |
| Lab D | Pre-Exam | 15 | 1 |

## Key Features

- **12-week cycles** with create/lock/unlock
- **Chrome-style tabs** for cycle navigation
- **Filter by**: Shift (AM/PM), Lab Type (Regular/Pre-Exam), Side (All/LH/RH)
- **Full-width grid** with lab grouping headers
- **Drag-select** to book or unbook multiple weeks
- **Locked cycles** are read-only (403 on mutations)
- **HubSpot integration** for contact lookup, deals, payment status
- **CSV export** per cycle
