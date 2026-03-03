import type { Cycle, CycleWeek } from '@prisma/client';

// --- Cycle Service Types ---
// courseCodes is stored as JSON string in DB (string | null), but services
// always parse it to string[] before returning. Omit the raw Prisma field
// and re-declare with the parsed type.
export interface CycleWithWeeks extends Omit<Cycle, 'courseCodes'> {
  cycleWeeks: CycleWeek[];
  courseCodes: string[];
}

// --- Grid Service Types ---
export interface GridRow {
  stationId: number;
  station: string;
  labName: string;
  side: string;
  availability: string[];
}

export interface WeekDate {
  week: number;
  startDate: Date | null;
  endDate: Date | null;
}

export interface GridResult {
  cycleId: number;
  shift: string;
  labType: string;
  side: string;
  locked: boolean;
  weeks: number[];
  weekDates: WeekDate[];
  grid: GridRow[];
}

// --- Booking Service Types ---
export interface BookSlotsInput {
  cycleId: number;
  stationId: number;
  shift: string;
  weeks: number[];
  traineeName: string;
  contactId?: string | null;
}

export interface UnbookSlotsInput {
  cycleId: number;
  stationId: number;
  shift: string;
  weeks: number[];
}

export interface FindBlocksInput {
  cycleId: number;
  shift: string;
  labType: string;
  side: string;
  startWeek: number;
  endWeek: number;
  weeksNeeded: number;
}

export interface AvailableBlock {
  id: string;
  stationId: number;
  lab: string;
  station: number;
  side: string;
  shift: string;
  weeks: number[];
}

// --- Analytics Types ---
export interface OccupancyEntry {
  week?: number;
  lab?: string;
  shift?: string;
  totalSlots: number;
  booked: number;
  percent: number;
}

export interface SeatingAnalyticsResult {
  weekOccupancy: OccupancyEntry[];
  labOccupancy: OccupancyEntry[];
  shiftOccupancy: OccupancyEntry[];
  summary: {
    totalSlots: number;
    totalBooked: number;
    overallPercent: number;
    numCycles: number;
  };
  bookingMatrix: Record<string, Record<number, number>>;
  labStationCounts: Record<string, number>;
}

export interface RegistrationWarning {
  cycleId: number;
  cycleName: string;
  shift: string;
  error: string;
}

export interface RegistrationAnalyticsResult {
  totalStudents: number;
  paymentDistribution: { status: string; count: number }[];
  cycleCountDistribution: { cycleNumber: number; count: number }[];
  programCounts: { roadmap: number; afk: number; acj: number };
  warnings: RegistrationWarning[];
}

// --- Respond helpers ---
export interface Respond {
  ok: (res: import('express').Response, data: unknown, message?: string) => void;
  list: (res: import('express').Response, items: unknown[], message?: string) => void;
  created: (res: import('express').Response, data: unknown, message?: string) => void;
}
