/*
  Warnings:

  - You are about to drop the column `start_date` on the `cycles` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "cycle_weeks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cycle_id" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "start_date" DATETIME,
    "end_date" DATETIME,
    CONSTRAINT "cycle_weeks_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cycles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_cycles" ("created_at", "id", "locked", "name", "number", "year") SELECT "created_at", "id", "locked", "name", "number", "year" FROM "cycles";
DROP TABLE "cycles";
ALTER TABLE "new_cycles" RENAME TO "cycles";
CREATE UNIQUE INDEX "cycles_name_key" ON "cycles"("name");
CREATE UNIQUE INDEX "cycles_year_number_key" ON "cycles"("year", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "cycle_weeks_cycle_id_week_key" ON "cycle_weeks"("cycle_id", "week");
