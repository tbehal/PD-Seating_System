'use strict';

/**
 * Shared test data factories for service unit tests.
 *
 * Each factory accepts an optional overrides object so individual tests can
 * customise only the fields they care about without repeating the full shape.
 *
 * NOTE: gridService.test.js keeps its own local helpers because its makeCycle
 * builds 12 CycleWeeks with real Date objects (date-range logic), and its
 * makeStation carries a bookings array — both too specialised to share cleanly.
 */

function makeCycle(overrides = {}) {
  return {
    id: 1,
    name: 'Cycle 1 - 2026',
    year: 2026,
    number: 1,
    locked: false,
    courseCodes: null,
    cycleWeeks: [],
    ...overrides,
  };
}

function makeStation(overrides = {}) {
  return {
    id: 1,
    lab: { name: 'Lab A', labType: 'REGULAR' },
    ...overrides,
  };
}

function makeLab(overrides = {}) {
  return {
    id: 1,
    name: 'Lab A',
    labType: 'REGULAR',
    ...overrides,
  };
}

function makeCycleWeek(overrides = {}) {
  return {
    id: 1,
    cycleId: 1,
    week: 1,
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

function makeBooking(overrides = {}) {
  return {
    id: 1,
    cycleId: 1,
    stationId: 1,
    shift: 'AM',
    week: 1,
    traineeName: 'John Doe',
    contactId: 'hub-123',
    ...overrides,
  };
}

/**
 * Shape matches the rows returned by analyticsService tests.
 * Fields mirror the registration list row structure used by HubSpot-backed
 * registrationService output (paymentStatus, cycleCount, hasRoadmap, etc.).
 */
function makeRegistrationRow(overrides = {}) {
  return {
    seatNumber: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-1234',
    studentId: 'S001',
    courseStartDate: null,
    courseEndDate: null,
    registrationDate: null,
    paymentStatus: 'Paid',
    outstanding: 0,
    cycleCount: 1,
    hasRoadmap: false,
    hasAFK: false,
    hasACJ: false,
    examDate: null,
    contactId: 'hs-001',
    dealId: 'deal-001',
    ...overrides,
  };
}

/**
 * Wraps rows in the envelope shape returned by registrationService.getRegistrationList.
 * shift defaults to 'AM'.
 */
function makeRegistrationResult(rows = [], shift = 'AM') {
  return {
    rows,
    meta: {
      totalStudents: rows.length,
      shift,
      fetchedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  makeCycle,
  makeStation,
  makeLab,
  makeCycleWeek,
  makeBooking,
  makeRegistrationRow,
  makeRegistrationResult,
};
