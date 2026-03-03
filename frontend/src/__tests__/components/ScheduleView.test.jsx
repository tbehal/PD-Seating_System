import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, resetStores } from '../test-utils';
import ScheduleView from '../../components/ScheduleView';
import { useScheduleStore } from '../../stores/scheduleStore';
import { toast } from 'sonner';

// --- API mock (exportCycle + searchContactByName are called directly) ---
vi.mock('../../api', () => ({
  exportCycle: vi.fn(),
  searchContactByName: vi.fn(),
}));
import { exportCycle, searchContactByName } from '../../api';

// --- Hook mocks ---
vi.mock('../../hooks/useGrid', () => ({
  useGrid: vi.fn(),
}));

vi.mock('../../hooks/useBookings', () => ({
  useBookSlot: vi.fn(),
  useUnbookSlot: vi.fn(),
  useResetBookings: vi.fn(),
  useFindCombinations: vi.fn(),
}));

vi.mock('../../hooks/useCycles', () => ({
  useCycles: vi.fn(),
  useUpdateWeeks: vi.fn(),
}));

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

// --- Child component mocks ---
vi.mock('../../components/FilterBar', () => ({
  default: () => <div data-testid="filter-bar">FilterBar</div>,
}));

vi.mock('../../components/SearchCriteriaForm', () => ({
  default: ({ onSearch, isLoading }) => (
    <div data-testid="search-form">
      <button data-testid="search-btn" onClick={() => onSearch()} disabled={isLoading}>
        Search
      </button>
    </div>
  ),
}));

vi.mock('../../components/SearchResults', () => ({
  default: ({ results, onSelect }) => (
    <div data-testid="search-results">
      {results && results.length > 0 && (
        <button data-testid="select-result" onClick={() => onSelect(results[0])}>
          Select
        </button>
      )}
    </div>
  ),
}));

vi.mock('../../components/BookingSection', () => ({
  default: ({ onBook, locked, selectedCombination, traineeName }) => (
    <div data-testid="booking-section">
      <button
        data-testid="book-btn"
        onClick={() => onBook && onBook()}
        disabled={locked || !selectedCombination || !traineeName}
      >
        Book
      </button>
    </div>
  ),
}));

vi.mock('../../components/AvailabilityGrid', () => ({
  default: ({ onBookCell, onShowStudentInfo, onExport, onClearAll, locked, data }) => (
    <div data-testid="availability-grid">
      <button
        data-testid="book-cell-btn"
        onClick={() =>
          onBookCell &&
          data &&
          onBookCell({
            stationId: 1,
            shift: 'AM',
            weeks: [1, 2],
          })
        }
      >
        Book Cell
      </button>
      <button
        data-testid="show-student-btn"
        onClick={() => onShowStudentInfo && data && onShowStudentInfo({ stationId: 1, week: 1 })}
      >
        Show Student
      </button>
      <button data-testid="export-btn" onClick={() => onExport && onExport()}>
        Export
      </button>
      <button data-testid="clear-all-btn" onClick={() => onClearAll && onClearAll()}>
        Clear All
      </button>
      {locked && <span data-testid="locked-indicator">Locked</span>}
    </div>
  ),
}));

vi.mock('../../components/CellBookingDialog', () => ({
  default: ({ dialog, onSubmit, onCancel }) =>
    dialog ? (
      <div data-testid="cell-booking-dialog" role="dialog">
        <button
          data-testid="cell-book-submit"
          onClick={() => onSubmit({ traineeName: 'Cell Student', contactId: '456' })}
        >
          Submit
        </button>
        <button data-testid="cell-book-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock('../../components/StudentInfoDialog', () => ({
  default: ({ dialog, onUnbook, onClose }) =>
    dialog ? (
      <div data-testid="student-info-dialog" role="dialog">
        <button
          data-testid="unbook-btn"
          onClick={() =>
            onUnbook({ stationId: dialog.stationId, shift: dialog.shift, week: dialog.week })
          }
        >
          Unbook
        </button>
        <button data-testid="close-student-dialog" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

// --- Hook imports (imported after mocking so vi.fn() references are live) ---
import { useGrid } from '../../hooks/useGrid';
import {
  useBookSlot,
  useUnbookSlot,
  useResetBookings,
  useFindCombinations,
} from '../../hooks/useBookings';
import { useCycles, useUpdateWeeks } from '../../hooks/useCycles';

// --- Shared mock data ---
const MOCK_CYCLE = { id: 1, name: 'Cycle 1 - 2026', year: 2026, number: 1, locked: false };
const LOCKED_CYCLE = { id: 2, name: 'Cycle 2 - 2026', year: 2026, number: 2, locked: true };

const MOCK_GRID_DATA = {
  grid: [
    {
      stationId: 1,
      station: 'A-01 LH',
      availability: ['John Doe', '✓', '✗'],
    },
  ],
  weeks: [1, 2, 3],
  shift: 'AM',
  labs: [{ id: 1, name: 'Lab A' }],
};

const MOCK_COMBINATIONS = [
  { stationId: 1, station: 'A-01 LH', weeks: [1, 2], shift: 'AM' },
  { stationId: 2, station: 'A-02 RH', weeks: [3, 4], shift: 'AM' },
];

// --- Default hook return values ---
function setupDefaultMocks() {
  useCycles.mockReturnValue({ data: [MOCK_CYCLE] });
  useGrid.mockReturnValue({ data: MOCK_GRID_DATA, isLoading: false, error: null });
  useBookSlot.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  useUnbookSlot.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  useResetBookings.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  });
  useFindCombinations.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(MOCK_COMBINATIONS),
    isPending: false,
  });
  useUpdateWeeks.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  exportCycle.mockResolvedValue(undefined);
  searchContactByName.mockResolvedValue(null);
}

// ---------------------------------------------------------------------------

describe('ScheduleView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    setupDefaultMocks();
    // Set an active cycle by default for most tests
    useScheduleStore.setState({ activeCycleId: 1 });
  });

  // -------------------------------------------------------------------------
  // Test 1 — Empty state when no active cycle
  // -------------------------------------------------------------------------
  test('renders with all sections even when no active cycle is selected', () => {
    useScheduleStore.setState({ activeCycleId: null });
    // Grid is disabled when cycleId is null (useGrid enabled: !!cycleId)
    useGrid.mockReturnValue({ data: undefined, isLoading: false, error: null });

    renderWithProviders(<ScheduleView />);

    // All structural sections still render
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
    expect(screen.getByTestId('search-form')).toBeInTheDocument();
    expect(screen.getByTestId('booking-section')).toBeInTheDocument();
    expect(screen.getByTestId('availability-grid')).toBeInTheDocument();

    // Book button is disabled — no selectedCombination and no traineeName
    expect(screen.getByTestId('book-btn')).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Test 2 — Renders grid and filters when cycle is active
  // -------------------------------------------------------------------------
  test('renders grid and filter components when an active cycle is set', () => {
    renderWithProviders(<ScheduleView />);

    expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
    expect(screen.getByTestId('search-form')).toBeInTheDocument();
    expect(screen.getByTestId('availability-grid')).toBeInTheDocument();
    expect(screen.getByTestId('booking-section')).toBeInTheDocument();
    expect(screen.getByTestId('search-results')).toBeInTheDocument();

    // CellBookingDialog and StudentInfoDialog are null when no dialog state
    expect(screen.queryByTestId('cell-booking-dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('student-info-dialog')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Test 3 — Search calls findCombinations and populates results
  // -------------------------------------------------------------------------
  test('handles search and displays results', async () => {
    const findCombinationsMutateAsync = vi.fn().mockResolvedValue(MOCK_COMBINATIONS);
    useFindCombinations.mockReturnValue({
      mutateAsync: findCombinationsMutateAsync,
      isPending: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    await user.click(screen.getByTestId('search-btn'));

    await waitFor(() => {
      expect(findCombinationsMutateAsync).toHaveBeenCalledOnce();
    });

    // The mutation receives cycleId + current store filters + searchCriteria
    expect(findCombinationsMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleId: 1,
        shift: 'AM',
        labType: 'REGULAR',
        side: 'ALL',
      }),
    );

    // SearchResults mock renders the select button only when results.length > 0
    await waitFor(() => {
      expect(screen.getByTestId('select-result')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Test 4 — Selecting a combination updates the store
  // -------------------------------------------------------------------------
  test('handles selecting a combination from search results', async () => {
    useFindCombinations.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(MOCK_COMBINATIONS),
      isPending: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    // Trigger search first
    await user.click(screen.getByTestId('search-btn'));

    // Wait for results to appear
    await waitFor(() => {
      expect(screen.getByTestId('select-result')).toBeInTheDocument();
    });

    // Select the first result
    await user.click(screen.getByTestId('select-result'));

    // Store must have the first combination selected
    await waitFor(() => {
      expect(useScheduleStore.getState().selectedCombination).toEqual(MOCK_COMBINATIONS[0]);
    });
  });

  // -------------------------------------------------------------------------
  // Test 5 — Search failure shows an error toast
  // -------------------------------------------------------------------------
  test('shows error toast when search fails', async () => {
    useFindCombinations.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error('Network error')),
      isPending: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    await user.click(screen.getByTestId('search-btn'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Search failed');
    });
  });

  // -------------------------------------------------------------------------
  // Test 6 — Cell click opens CellBookingDialog; submit calls bookSlot
  // -------------------------------------------------------------------------
  test('handles cell click opening CellBookingDialog and submitting a booking', async () => {
    const bookSlotMutateAsync = vi.fn().mockResolvedValue({});
    useBookSlot.mockReturnValue({ mutateAsync: bookSlotMutateAsync, isPending: false });

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    // Click a grid cell — AvailabilityGrid mock calls onBookCell with stationId=1
    await user.click(screen.getByTestId('book-cell-btn'));

    // Dialog must appear
    await waitFor(() => {
      expect(screen.getByTestId('cell-booking-dialog')).toBeInTheDocument();
    });

    // Submit the dialog
    await user.click(screen.getByTestId('cell-book-submit'));

    await waitFor(() => {
      expect(bookSlotMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          cycleId: 1,
          stationId: 1,
          shift: 'AM',
          weeks: [1, 2],
          traineeName: 'Cell Student',
          contactId: '456',
        }),
      );
    });

    // Dialog closes after success
    await waitFor(() => {
      expect(screen.queryByTestId('cell-booking-dialog')).not.toBeInTheDocument();
    });

    expect(toast.success).toHaveBeenCalledWith('Booked successfully');
  });

  // -------------------------------------------------------------------------
  // Test 7 — Cancel on CellBookingDialog closes dialog without booking
  // -------------------------------------------------------------------------
  test('cancels cell booking dialog without calling bookSlot', async () => {
    const bookSlotMutateAsync = vi.fn();
    useBookSlot.mockReturnValue({ mutateAsync: bookSlotMutateAsync, isPending: false });

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    await user.click(screen.getByTestId('book-cell-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('cell-booking-dialog')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('cell-book-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('cell-booking-dialog')).not.toBeInTheDocument();
    });

    expect(bookSlotMutateAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 8 — Student click opens StudentInfoDialog; unbook calls unbookSlot
  // -------------------------------------------------------------------------
  test('handles student click opening StudentInfoDialog then unbooking', async () => {
    const unbookSlotMutateAsync = vi.fn().mockResolvedValue({});
    useUnbookSlot.mockReturnValue({ mutateAsync: unbookSlotMutateAsync, isPending: false });

    // searchContactByName is called during handleShowStudentInfo
    searchContactByName.mockResolvedValue({ id: 'hs-123', fullName: 'John Doe' });

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    // The mock grid calls onShowStudentInfo with stationId=1, week=1
    // gridData.grid[0] has stationId=1 and availability[0]='John Doe' (not a check mark)
    await user.click(screen.getByTestId('show-student-btn'));

    // Dialog appears (studentName 'John Doe' triggers setStudentInfoDialog)
    await waitFor(() => {
      expect(screen.getByTestId('student-info-dialog')).toBeInTheDocument();
    });

    // Click unbook
    await user.click(screen.getByTestId('unbook-btn'));

    await waitFor(() => {
      expect(unbookSlotMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          cycleId: 1,
          stationId: 1,
          shift: 'AM',
          weeks: [1],
        }),
      );
    });

    // Dialog closes after unbook
    await waitFor(() => {
      expect(screen.queryByTestId('student-info-dialog')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Test 9 — StudentInfoDialog close button closes dialog without unbooking
  // -------------------------------------------------------------------------
  test('closes StudentInfoDialog without unbooking when close is clicked', async () => {
    const unbookSlotMutateAsync = vi.fn();
    useUnbookSlot.mockReturnValue({ mutateAsync: unbookSlotMutateAsync, isPending: false });
    searchContactByName.mockResolvedValue(null);

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    await user.click(screen.getByTestId('show-student-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('student-info-dialog')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('close-student-dialog'));

    await waitFor(() => {
      expect(screen.queryByTestId('student-info-dialog')).not.toBeInTheDocument();
    });

    expect(unbookSlotMutateAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 10 — Locked cycle passes locked=true to AvailabilityGrid
  // -------------------------------------------------------------------------
  test('passes locked=true to AvailabilityGrid when the active cycle is locked', () => {
    // Return the locked cycle from useCycles and set activeCycleId to its id
    useCycles.mockReturnValue({ data: [LOCKED_CYCLE] });
    useScheduleStore.setState({ activeCycleId: 2 });

    renderWithProviders(<ScheduleView />);

    // The mock AvailabilityGrid renders a locked-indicator span when locked prop is true
    expect(screen.getByTestId('locked-indicator')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Test 11 — Export calls exportCycle with correct args
  // -------------------------------------------------------------------------
  test('handles export by calling exportCycle with cycleId and filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    await user.click(screen.getByTestId('export-btn'));

    await waitFor(() => {
      expect(exportCycle).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ shift: 'AM', labType: 'REGULAR', side: 'ALL' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Test 12 — Export failure shows an error toast
  // -------------------------------------------------------------------------
  test('shows error toast when export fails', async () => {
    exportCycle.mockRejectedValue(new Error('Network error'));

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    await user.click(screen.getByTestId('export-btn'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Export failed');
    });
  });

  // -------------------------------------------------------------------------
  // Test 13 — Clear all calls resetAllBookings mutation
  // -------------------------------------------------------------------------
  test('handles clear all by calling resetBookings mutation with cycleId', async () => {
    const resetMutateAsync = vi.fn().mockResolvedValue({});
    useResetBookings.mockReturnValue({ mutateAsync: resetMutateAsync, isPending: false });

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    await user.click(screen.getByTestId('clear-all-btn'));

    await waitFor(() => {
      expect(resetMutateAsync).toHaveBeenCalledWith(1);
    });
  });

  // -------------------------------------------------------------------------
  // Test 14 — Clear all failure shows an error toast
  // -------------------------------------------------------------------------
  test('shows error toast when clear all fails', async () => {
    useResetBookings.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({ response: { data: { error: 'DB error' } } }),
      isPending: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    await user.click(screen.getByTestId('clear-all-btn'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('DB error');
    });
  });

  // -------------------------------------------------------------------------
  // Test 15 — handleSearch does nothing when no active cycle
  // -------------------------------------------------------------------------
  test('search does not call findCombinations when there is no active cycle', async () => {
    useScheduleStore.setState({ activeCycleId: null });
    const findCombinationsMutateAsync = vi.fn();
    useFindCombinations.mockReturnValue({
      mutateAsync: findCombinationsMutateAsync,
      isPending: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    await user.click(screen.getByTestId('search-btn'));

    // handleSearch returns early when !activeCycleId
    expect(findCombinationsMutateAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 16 — Cell booking failure shows error toast
  // -------------------------------------------------------------------------
  test('shows error toast when cell booking fails', async () => {
    useBookSlot.mockReturnValue({
      mutateAsync: vi
        .fn()
        .mockRejectedValue({ response: { data: { error: 'Slot already booked.' } } }),
      isPending: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<ScheduleView />);

    await user.click(screen.getByTestId('book-cell-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('cell-booking-dialog')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('cell-book-submit'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Slot already booked.');
    });

    // Dialog remains open on failure
    expect(screen.getByTestId('cell-booking-dialog')).toBeInTheDocument();
  });
});
