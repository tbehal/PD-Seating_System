-- CreateTable
CREATE TABLE "labs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "lab_type" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "stations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lab_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    CONSTRAINT "stations_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "start_date" DATETIME,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cycle_id" INTEGER NOT NULL,
    "station_id" INTEGER NOT NULL,
    "shift" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "trainee_name" TEXT NOT NULL,
    "contact_id" TEXT,
    "booked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bookings_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bookings_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "labs_name_key" ON "labs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "stations_lab_id_number_key" ON "stations"("lab_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "cycles_name_key" ON "cycles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cycles_year_number_key" ON "cycles"("year", "number");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_cycle_id_station_id_shift_week_key" ON "bookings"("cycle_id", "station_id", "shift", "week");
