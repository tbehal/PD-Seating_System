import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, resetStores } from '../test-utils';
import AnalyticsDashboard from '../../components/AnalyticsDashboard';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../hooks/useAnalytics', () => ({
  useSeatingAnalytics: vi.fn(),
  useRegistrationAnalytics: vi.fn(),
}));

vi.mock('../../hooks/useCycles', () => ({
  useCycles: vi.fn(),
}));

// Recharts uses canvas/SVG which jsdom cannot measure. Replace every chart
// primitive with a plain div so renders complete without errors.
vi.mock('recharts', () => {
  const MockChart = ({ children, ...props }) => (
    <div data-testid="chart" {...props}>
      {children}
    </div>
  );
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
    BarChart: MockChart,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    PieChart: MockChart,
    Pie: () => null,
    Cell: () => null,
  };
});

// chartTheme reads CSS variables that don't exist in jsdom — return safe defaults.
vi.mock('../../lib/chartTheme', () => ({
  getChartColors: () => ({
    primary: '#6366f1',
    secondary: '#10b981',
    tertiary: '#f59e0b',
    quaternary: '#ef4444',
    success: '#22c55e',
    warning: '#f97316',
    danger: '#ef4444',
    purple: '#a855f7',
    muted: '#6b7280',
  }),
  getAxisStyle: () => ({
    tick: { fill: '#6b7280' },
    axisLine: { stroke: '#6b7280' },
    gridStroke: '#6b728033',
  }),
  getProgramColors: () => ({
    roadmap: '#6366f1',
    afk: '#22c55e',
    acj: '#a855f7',
  }),
}));

// PDF export libs are dynamically imported inside handleExportPDF — no need to
// mock them at the module level since we skip PDF tests.

// ─── Lazy-import mocked hooks after vi.mock hoisting ─────────────────────────

import { useSeatingAnalytics, useRegistrationAnalytics } from '../../hooks/useAnalytics';
import { useCycles } from '../../hooks/useCycles';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockCycles = [
  { id: 1, name: 'Cycle 1 - 2026', year: 2026, number: 1, locked: false, courseCodes: ['NDC-AM'] },
  { id: 2, name: 'Cycle 2 - 2026', year: 2026, number: 2, locked: false, courseCodes: ['NDC-PM'] },
];

const mockSeatingData = {
  weekOccupancy: [
    { week: 1, totalSlots: 40, booked: 30, percent: 75 },
    { week: 2, totalSlots: 40, booked: 20, percent: 50 },
  ],
  labOccupancy: [{ lab: 'Lab A', totalSlots: 80, booked: 48, percent: 60 }],
  shiftOccupancy: [
    { shift: 'AM', totalSlots: 80, booked: 56, percent: 70 },
    { shift: 'PM', totalSlots: 80, booked: 24, percent: 30 },
  ],
  bookingMatrix: { 'Lab A': { 1: 30, 2: 20 } },
  labStationCounts: { 'Lab A': 20 },
  summary: {
    totalSlots: 160,
    totalBooked: 80,
    overallPercent: 65.0,
    numCycles: 1,
  },
};

const mockRegistrationData = {
  totalStudents: 10,
  paymentDistribution: [
    { status: 'Closed Won', count: 8 },
    { status: 'Open', count: 2 },
  ],
  cycleCountDistribution: [
    { cycleNumber: 1, count: 5 },
    { cycleNumber: 2, count: 5 },
  ],
  programCounts: { roadmap: 3, afk: 2, acj: 1 },
  warnings: [],
};

// ─── Default mock setup ───────────────────────────────────────────────────────

function setupDefaultMocks() {
  useCycles.mockReturnValue({ data: mockCycles });
  useSeatingAnalytics.mockReturnValue({
    data: mockSeatingData,
    isLoading: false,
    error: null,
  });
  useRegistrationAnalytics.mockReturnValue({
    data: mockRegistrationData,
    isLoading: false,
    error: null,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // 1. No cycles at all → empty state
  test('renders empty state when no cycles exist', () => {
    useCycles.mockReturnValue({ data: [] });
    // With no cycles, noCyclesForYear=true so analytics hooks receive null year
    // and the component renders the no-data message.
    useSeatingAnalytics.mockReturnValue({ data: undefined, isLoading: false, error: null });
    useRegistrationAnalytics.mockReturnValue({ data: undefined, isLoading: false, error: null });

    renderWithProviders(<AnalyticsDashboard />);

    expect(screen.getByText('No data available for selected filters.')).toBeInTheDocument();
  });

  // 2. Seating data loading → skeleton shown, charts absent
  test('renders loading state for seating analytics', () => {
    useSeatingAnalytics.mockReturnValue({ data: undefined, isLoading: true, error: null });

    renderWithProviders(<AnalyticsDashboard />);

    // ChartCard renders SkeletonChart (a div with bar-like children) while loading.
    // Neither chart containers nor error messages should appear for seating section.
    expect(screen.queryByText('Failed to load seating data.')).not.toBeInTheDocument();
    // The section headings are always present
    expect(screen.getByText('Weekly Occupancy')).toBeInTheDocument();
    expect(screen.getByText('Lab Occupancy')).toBeInTheDocument();
    expect(screen.getByText('Shift Comparison')).toBeInTheDocument();
  });

  // 3. Registration data loading → skeleton shown
  test('renders loading state for registration analytics', () => {
    useRegistrationAnalytics.mockReturnValue({ data: undefined, isLoading: true, error: null });

    renderWithProviders(<AnalyticsDashboard />);

    expect(screen.queryByText('Failed to load registration data.')).not.toBeInTheDocument();
    expect(screen.getByText('Payment Status')).toBeInTheDocument();
    expect(screen.getByText('Cycle Count Distribution')).toBeInTheDocument();
  });

  // 4. Seating analytics error → error message rendered inside ChartCard
  test('renders error state for seating analytics', () => {
    const err = new Error('Network timeout');
    useSeatingAnalytics.mockReturnValue({ data: undefined, isLoading: false, error: err });

    renderWithProviders(<AnalyticsDashboard />);

    // ErrorMsg component renders the message text inside ChartCard
    expect(screen.getAllByText('Network timeout').length).toBeGreaterThan(0);
  });

  // 5. Registration analytics error — 503 shows friendly HubSpot message
  test('renders HubSpot-not-configured message on 503 registration error', () => {
    const err = { response: { status: 503 }, message: 'Service Unavailable' };
    useRegistrationAnalytics.mockReturnValue({ data: undefined, isLoading: false, error: err });

    renderWithProviders(<AnalyticsDashboard />);

    expect(
      screen.getAllByText('HubSpot not configured. Registration analytics unavailable.').length,
    ).toBeGreaterThan(0);
  });

  // 6. Full seating data → chart containers visible
  test('renders seating analytics chart containers when data is available', () => {
    renderWithProviders(<AnalyticsDashboard />);

    // ResponsiveContainer mocks render as data-testid="responsive-container"
    const containers = screen.getAllByTestId('responsive-container');
    // Seating section has 3 charts: WeekOccupancy, LabOccupancy, ShiftComparison
    expect(containers.length).toBeGreaterThanOrEqual(3);
  });

  // 7. Full registration data → registration chart containers visible
  test('renders registration analytics chart containers when data is available', () => {
    renderWithProviders(<AnalyticsDashboard />);

    // Registration section adds: PaymentPie, ProgramChart, CycleCountChart = 3 more
    const containers = screen.getAllByTestId('responsive-container');
    // Total = 3 seating + 3 registration = 6
    expect(containers.length).toBeGreaterThanOrEqual(6);
  });

  // 8. Summary cards show correct values from seating & registration data
  test('renders summary cards with correct computed values', () => {
    renderWithProviders(<AnalyticsDashboard />);

    // Overall Occupancy: mockSeatingData.summary.overallPercent = 65.0
    expect(screen.getByText('65.0%')).toBeInTheDocument();

    // Total Students: mockRegistrationData.totalStudents = 10
    expect(screen.getByText('10')).toBeInTheDocument();

    // AM Occupancy: shiftOccupancy[0].percent = 70 → "70.0%"
    expect(screen.getByText('70.0%')).toBeInTheDocument();

    // PM Occupancy: shiftOccupancy[1].percent = 30 → "30.0%"
    expect(screen.getByText('30.0%')).toBeInTheDocument();
  });

  // 9. Year filter: select shows available years derived from cycles
  test('renders year filter dropdown with years from cycles', () => {
    renderWithProviders(<AnalyticsDashboard />);

    // Both cycles have year 2026 — dropdown should have 2026 as option
    const yearSelect = screen.getByDisplayValue('2026');
    expect(yearSelect).toBeInTheDocument();
  });

  // 10. Changing the year resets cycle selection and re-calls hooks
  test('changing year filter calls analytics hooks with the new year', async () => {
    const user = userEvent.setup();

    // Add a cycle from a different year so the dropdown has two options
    useCycles.mockReturnValue({
      data: [
        ...mockCycles,
        { id: 3, name: 'Cycle 1 - 2025', year: 2025, number: 1, locked: false, courseCodes: [] },
      ],
    });

    renderWithProviders(<AnalyticsDashboard />);

    const yearSelect = screen.getByDisplayValue('2026');
    await user.selectOptions(yearSelect, '2025');

    await waitFor(() => {
      // After selecting 2025, hook should have been called with year=2025
      expect(useSeatingAnalytics).toHaveBeenCalledWith(2025, null);
    });
  });

  // 11. Cycle filter dropdown lists cycles for the selected year
  test('cycle filter dropdown renders available cycles for selected year', () => {
    renderWithProviders(<AnalyticsDashboard />);

    // Both mock cycles belong to 2026 and should appear as options
    expect(screen.getByRole('option', { name: 'Cycle 1 - 2026' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cycle 2 - 2026' })).toBeInTheDocument();
    // "All Cycles" option is always present
    expect(screen.getByRole('option', { name: 'All Cycles' })).toBeInTheDocument();
  });

  // 12. Selecting a specific cycle passes cycleId to analytics hooks
  test('selecting a cycle passes cycleId to analytics hooks', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AnalyticsDashboard />);

    const cycleSelect = screen.getByDisplayValue('All Cycles');
    await user.selectOptions(cycleSelect, '1');

    await waitFor(() => {
      expect(useSeatingAnalytics).toHaveBeenCalledWith(2026, 1);
      expect(useRegistrationAnalytics).toHaveBeenCalledWith(2026, 'BOTH', 1);
    });
  });

  // 13. Shift filter: AM/PM/Both buttons switch the shift passed to registration hook
  test('clicking shift filter buttons passes the correct shift to the registration hook', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AnalyticsDashboard />);

    // Default is BOTH
    expect(useRegistrationAnalytics).toHaveBeenCalledWith(2026, 'BOTH', null);

    // Click AM
    await user.click(screen.getByRole('button', { name: 'AM' }));
    await waitFor(() => {
      expect(useRegistrationAnalytics).toHaveBeenCalledWith(2026, 'AM', null);
    });

    // Click PM
    await user.click(screen.getByRole('button', { name: 'PM' }));
    await waitFor(() => {
      expect(useRegistrationAnalytics).toHaveBeenCalledWith(2026, 'PM', null);
    });
  });

  // 14. Warnings in registration data are surfaced via the hook (no direct render)
  // The component itself does NOT display warnings inline — they are tracked in the
  // data object. We verify the component still renders successfully with warnings present.
  test('renders successfully when registration data contains warnings', () => {
    useRegistrationAnalytics.mockReturnValue({
      data: {
        ...mockRegistrationData,
        warnings: [
          { cycleId: 1, message: 'HubSpot rate limited' },
          { cycleId: 2, message: 'Missing contact data' },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<AnalyticsDashboard />);

    // Dashboard renders without crashing; summary cards are present
    expect(screen.getByText('Total Students')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  // 15. Zero total students — summary card shows 0, not —
  test('shows 0 for Total Students when totalStudents is 0', () => {
    useRegistrationAnalytics.mockReturnValue({
      data: {
        ...mockRegistrationData,
        totalStudents: 0,
        paymentDistribution: [],
        cycleCountDistribution: [],
        programCounts: { roadmap: 0, afk: 0, acj: 0 },
      },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<AnalyticsDashboard />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  // 16. No weekly data → empty message inside Weekly Occupancy card
  test('shows no-weekly-data message when weekOccupancy is empty', () => {
    useSeatingAnalytics.mockReturnValue({
      data: { ...mockSeatingData, weekOccupancy: [] },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<AnalyticsDashboard />);

    expect(screen.getByText('No weekly data available.')).toBeInTheDocument();
  });

  // 17. No lab data → empty message inside Lab Occupancy card
  test('shows no-lab-data message when labOccupancy is empty', () => {
    useSeatingAnalytics.mockReturnValue({
      data: { ...mockSeatingData, labOccupancy: [] },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<AnalyticsDashboard />);

    expect(screen.getByText('No lab data available.')).toBeInTheDocument();
  });

  // 18. No payment data → empty message inside Payment Status card
  test('shows no-payment-data message when paymentDistribution is empty', () => {
    useRegistrationAnalytics.mockReturnValue({
      data: { ...mockRegistrationData, paymentDistribution: [] },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<AnalyticsDashboard />);

    expect(screen.getByText('No payment data available.')).toBeInTheDocument();
  });

  // 19. No cycle count data → empty message inside Cycle Count Distribution card
  test('shows no-cycle-count-data message when cycleCountDistribution is empty', () => {
    useRegistrationAnalytics.mockReturnValue({
      data: { ...mockRegistrationData, cycleCountDistribution: [] },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<AnalyticsDashboard />);

    expect(screen.getByText('No cycle count data available.')).toBeInTheDocument();
  });

  // 20. Page title and Back button are always visible
  test('renders page heading and Back button', () => {
    renderWithProviders(<AnalyticsDashboard />);

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  // 21. Export PDF button is present and disabled while data is loading
  test('Export PDF button is disabled while analytics are loading', () => {
    useSeatingAnalytics.mockReturnValue({ data: undefined, isLoading: true, error: null });

    renderWithProviders(<AnalyticsDashboard />);

    const exportBtn = screen.getByRole('button', { name: /export pdf/i });
    expect(exportBtn).toBeDisabled();
  });

  // 22. Export PDF button is enabled when data is ready
  test('Export PDF button is enabled when data is loaded', () => {
    renderWithProviders(<AnalyticsDashboard />);

    const exportBtn = screen.getByRole('button', { name: /export pdf/i });
    expect(exportBtn).not.toBeDisabled();
  });
});
