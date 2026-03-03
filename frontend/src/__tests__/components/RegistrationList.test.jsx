import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, resetStores } from '../test-utils';
import RegistrationList from '../../components/RegistrationList';
import { useScheduleStore } from '../../stores/scheduleStore';

// --- Module mocks ---

vi.mock('../../hooks/useRegistration', () => ({
  useRegistrationList: vi.fn(),
  useRefreshRegistration: vi.fn(),
}));

vi.mock('../../hooks/useCycles', () => ({
  useCycles: vi.fn(),
  useUpdateCourseCodes: vi.fn(),
}));

// useFocusTrap is a NAMED export in this project
vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

vi.mock('../../api', () => ({
  exportRegistrationList: vi.fn(),
}));

import { useRegistrationList, useRefreshRegistration } from '../../hooks/useRegistration';
import { useCycles, useUpdateCourseCodes } from '../../hooks/useCycles';

// --- Mock data ---

const mockCycles = [
  {
    id: 1,
    name: 'Cycle 1 - 2026',
    year: 2026,
    number: 1,
    locked: false,
    courseCodes: ['NDC-AM'],
  },
];

// Note: the component filters on row.paymentStatus (not row.dealStage).
// Rows must include paymentStatus for filter tests to work.
const mockRegistrationData = {
  rows: [
    {
      contactId: '101',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      studentId: 'STU001',
      phone: '555-1234',
      seatNumber: 1,
      paymentStatus: 'Closed Won',
      outstanding: 0,
      courseStartDate: '2026-01-15',
      courseEndDate: '2026-04-15',
      registrationDate: '2025-12-01',
      examDate: null,
      hasRoadmap: true,
      hasAFK: false,
      hasACJ: false,
      cycleCount: 2,
      lineItemName: 'NDC-AM',
    },
    {
      contactId: '102',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      studentId: 'STU002',
      phone: '555-5678',
      seatNumber: 2,
      paymentStatus: 'Appointment Scheduled',
      outstanding: 5000,
      courseStartDate: '2026-02-01',
      courseEndDate: '2026-05-01',
      registrationDate: '2026-01-10',
      examDate: null,
      hasRoadmap: false,
      hasAFK: true,
      hasACJ: true,
      cycleCount: 1,
      lineItemName: 'NDC-PM',
    },
  ],
  meta: {
    cycleId: 1,
    shift: 'AM',
    courseCodes: ['NDC-AM'],
    totalStudents: 2,
    noCodes: false,
    fetchedAt: '2026-03-03T10:00:00.000Z',
  },
  warnings: [],
};

// --- Default hook return values ---

function setupDefaultMocks() {
  useCycles.mockReturnValue({ data: mockCycles });
  useUpdateCourseCodes.mockReturnValue({ mutateAsync: vi.fn() });
  useRefreshRegistration.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useRegistrationList.mockReturnValue({
    data: mockRegistrationData,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
}

// --- Tests ---

describe('RegistrationList', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // 1. No cycle selected
  test('renders empty state when no cycle is selected', () => {
    // activeCycleId defaults to null after resetStores()
    renderWithProviders(<RegistrationList />);

    expect(screen.getByText('Select a cycle to view the registration list.')).toBeInTheDocument();
  });

  // 2. No course codes configured
  test('renders no-course-codes state when meta.noCodes is true', () => {
    useScheduleStore.setState({ activeCycleId: 1 });
    useRegistrationList.mockReturnValue({
      data: {
        rows: [],
        meta: { noCodes: true },
        warnings: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithProviders(<RegistrationList />);

    expect(screen.getByText('No course codes configured for this cycle.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add course codes/i })).toBeInTheDocument();
  });

  // 3. Loading skeleton
  test('renders loading skeleton while fetching', () => {
    useScheduleStore.setState({ activeCycleId: 1 });
    useRegistrationList.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    renderWithProviders(<RegistrationList />);

    // SkeletonTable renders a <table> with skeleton rows; the data table is absent
    // Neither student name nor error message should appear
    expect(screen.queryByText('John')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed to load registration data')).not.toBeInTheDocument();
    // Controls bar is always rendered when cycleId is set
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
  });

  // 4. Error state with Retry button
  test('renders error state with retry button', () => {
    useScheduleStore.setState({ activeCycleId: 1 });
    const mockRefetch = vi.fn();
    useRegistrationList.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: mockRefetch,
    });

    renderWithProviders(<RegistrationList />);

    expect(screen.getByText('Failed to load registration data')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // 4b. Retry button calls refetch
  test('clicking Retry calls refetch', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });
    const mockRefetch = vi.fn();
    useRegistrationList.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: mockRefetch,
    });

    renderWithProviders(<RegistrationList />);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // 5. Renders registration table with student data
  test('renders registration table with student data', () => {
    useScheduleStore.setState({ activeCycleId: 1 });

    renderWithProviders(<RegistrationList />);

    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(screen.getByText('Smith')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    // Student count in the meta bar
    expect(screen.getByText(/showing 2 of 2 students/i)).toBeInTheDocument();
  });

  // 6. Search filter by name
  test('filters rows by search query (name)', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });

    renderWithProviders(<RegistrationList />);

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    await user.type(searchInput, 'John');

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.queryByText('Jane')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/showing 1 of 2 students.*filtered/i)).toBeInTheDocument();
  });

  // 6b. Search filter by email
  test('filters rows by search query (email)', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });

    renderWithProviders(<RegistrationList />);

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    await user.type(searchInput, 'jane@');

    await waitFor(() => {
      expect(screen.getByText('Jane')).toBeInTheDocument();
      expect(screen.queryByText('John')).not.toBeInTheDocument();
    });
  });

  // 7. Filter by payment status
  test('filters rows by payment status', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });

    renderWithProviders(<RegistrationList />);

    // Both rows visible initially
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();

    // Select "Closed Won" in the Payment Status dropdown
    const paymentSelect = screen.getByDisplayValue('Payment Status: All');
    await user.selectOptions(paymentSelect, 'Closed Won');

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.queryByText('Jane')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/showing 1 of 2 students.*filtered/i)).toBeInTheDocument();
  });

  // 8. Filter by Roadmap = YES
  test('filters rows by Roadmap: YES', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });

    renderWithProviders(<RegistrationList />);

    const roadmapSelect = screen.getByDisplayValue('Roadmap: All');
    await user.selectOptions(roadmapSelect, 'YES');

    await waitFor(() => {
      // John has hasRoadmap: true, Jane does not
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.queryByText('Jane')).not.toBeInTheDocument();
    });
  });

  // 9. Filter by AFK = YES
  test('filters rows by AFK: YES', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });

    renderWithProviders(<RegistrationList />);

    const afkSelect = screen.getByDisplayValue('AFK: All');
    await user.selectOptions(afkSelect, 'YES');

    await waitFor(() => {
      // Jane has hasAFK: true, John does not
      expect(screen.getByText('Jane')).toBeInTheDocument();
      expect(screen.queryByText('John')).not.toBeInTheDocument();
    });
  });

  // 10. Clear all filters restores all rows
  test('clears all filters and restores all rows', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });

    renderWithProviders(<RegistrationList />);

    // Apply Roadmap = YES (hides Jane)
    const roadmapSelect = screen.getByDisplayValue('Roadmap: All');
    await user.selectOptions(roadmapSelect, 'YES');

    await waitFor(() => {
      expect(screen.queryByText('Jane')).not.toBeInTheDocument();
    });

    // "Clear Filters" button appears when any filter is active
    const clearBtn = screen.getByRole('button', { name: /clear filters/i });
    await user.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });

    // "Clear Filters" button should disappear once filters are reset
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  // 10b. Clear Filters also clears the search query
  test('clear filters also resets the search query', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });

    renderWithProviders(<RegistrationList />);

    // Type in search — this activates the search but "Clear Filters" only appears
    // when column filters are active (hasActiveFilters). Apply a column filter too.
    const searchInput = screen.getByPlaceholderText(/search by name/i);
    await user.type(searchInput, 'John');

    const roadmapSelect = screen.getByDisplayValue('Roadmap: All');
    await user.selectOptions(roadmapSelect, 'YES');

    await waitFor(() => {
      expect(screen.queryByText('Jane')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    await waitFor(() => {
      expect(searchInput).toHaveValue('');
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });
  });

  // 11. Shift toggle switches between AM and PM
  test('renders AM and PM shift buttons and switching them re-queries', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });

    renderWithProviders(<RegistrationList />);

    // AM is selected by default
    const amBtn = screen.getByRole('button', { name: /morning \(am\)/i });
    const pmBtn = screen.getByRole('button', { name: /afternoon \(pm\)/i });

    expect(amBtn).toBeInTheDocument();
    expect(pmBtn).toBeInTheDocument();

    // Initial call was with shift = 'AM'
    expect(useRegistrationList).toHaveBeenCalledWith(1, 'AM');

    await user.click(pmBtn);

    // After clicking PM the hook should be called with 'PM'
    await waitFor(() => {
      expect(useRegistrationList).toHaveBeenCalledWith(1, 'PM');
    });
  });

  // 12. Edit Course Codes dialog opens and closes
  test('opens and cancels the Edit Course Codes dialog', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });

    renderWithProviders(<RegistrationList />);

    // Dialog should not be visible initially
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /edit course codes/i }));

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText('Edit Course Codes')).toBeInTheDocument();
    });

    // Close with Cancel
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // 12b. Edit Course Codes dialog saves and calls mutation
  test('saves course codes via mutation', async () => {
    const user = userEvent.setup();
    useScheduleStore.setState({ activeCycleId: 1 });
    const mockMutateAsync = vi.fn().mockResolvedValue({});
    useUpdateCourseCodes.mockReturnValue({ mutateAsync: mockMutateAsync });

    renderWithProviders(<RegistrationList />);

    await user.click(screen.getByRole('button', { name: /edit course codes/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Clear textarea and type a new code
    const textarea = screen.getByPlaceholderText(/NDC-26/i);
    await user.clear(textarea);
    await user.type(textarea, 'NDC-26-NEW-AM');

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        cycleId: 1,
        courseCodes: ['NDC-26-NEW-AM'],
      });
    });

    // Dialog closes after successful save
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // 13. Empty state: data with rows.length === 0 and noCodes = false
  test('renders no-students empty state when rows array is empty', () => {
    useScheduleStore.setState({ activeCycleId: 1 });
    useRegistrationList.mockReturnValue({
      data: {
        rows: [],
        meta: { noCodes: false, fetchedAt: null },
        warnings: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithProviders(<RegistrationList />);

    expect(
      screen.getByText('No students found for the selected course codes and shift.'),
    ).toBeInTheDocument();
  });

  // 14. Course codes badges render from the active cycle
  test('renders course code badges from the active cycle', () => {
    useScheduleStore.setState({ activeCycleId: 1 });
    useCycles.mockReturnValue({
      data: [
        {
          id: 1,
          name: 'Cycle 1',
          year: 2026,
          number: 1,
          locked: false,
          courseCodes: ['NDC-AM', 'NDC-PM'],
        },
      ],
    });

    renderWithProviders(<RegistrationList />);

    expect(screen.getByText('NDC-AM')).toBeInTheDocument();
    expect(screen.getByText('NDC-PM')).toBeInTheDocument();
  });
});
