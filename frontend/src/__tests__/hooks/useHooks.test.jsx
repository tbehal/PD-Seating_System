import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useScheduleStore } from '../../stores/scheduleStore';

// Mock the entire api module
vi.mock('../../api', () => ({
  fetchCycles: vi.fn(),
  createCycle: vi.fn(),
  deleteCycle: vi.fn(),
  lockCycle: vi.fn(),
  unlockCycle: vi.fn(),
  updateCycleWeeks: vi.fn(),
  updateCourseCodes: vi.fn(),
  fetchGrid: vi.fn(),
  bookSlot: vi.fn(),
  unbookSlot: vi.fn(),
  resetAllBookings: vi.fn(),
  findCombinations: vi.fn(),
  searchContacts: vi.fn(),
  getContactById: vi.fn(),
  fetchRegistrationList: vi.fn(),
  fetchSeatingAnalytics: vi.fn(),
  fetchRegistrationAnalytics: vi.fn(),
  exportCycle: vi.fn(),
}));

import * as api from '../../api';
import {
  useCycles,
  useCreateCycle,
  useDeleteCycle,
  useUpdateWeeks,
  useUpdateCourseCodes,
} from '../../hooks/useCycles';
import { useGrid } from '../../hooks/useGrid';
import { useBookSlot, useFindCombinations, useUnbookSlot } from '../../hooks/useBookings';
import { useContactSearch, useContact } from '../../hooks/useContacts';
import { useRegistrationList, useRefreshRegistration } from '../../hooks/useRegistration';
import { useSeatingAnalytics, useRegistrationAnalytics } from '../../hooks/useAnalytics';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useScheduleStore.getState().reset();
});

// ---------------------------------------------------------------------------
// useCycles
// ---------------------------------------------------------------------------

describe('useCycles', () => {
  test('returns cycle data on successful fetch', async () => {
    const mockCycles = [
      { id: 1, year: 2026, number: 1, locked: false },
      { id: 2, year: 2026, number: 2, locked: true },
    ];
    api.fetchCycles.mockResolvedValue(mockCycles);

    const { result } = renderHook(() => useCycles(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockCycles);
    expect(api.fetchCycles).toHaveBeenCalledTimes(1);
  });

  test('exposes error when fetchCycles rejects', async () => {
    api.fetchCycles.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCycles(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('Network error');
  });
});

describe('useCreateCycle', () => {
  test('calls createCycle API with correct args', async () => {
    const newCycle = { id: 3, year: 2026, number: 3 };
    api.createCycle.mockResolvedValue(newCycle);
    // fetchCycles needed so invalidation does not throw
    api.fetchCycles.mockResolvedValue([]);

    const { result } = renderHook(() => useCreateCycle(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ year: 2026, courseCodes: ['NDC'] });

    expect(api.createCycle).toHaveBeenCalledWith(2026, ['NDC']);
  });

  test('sets activeCycleId in scheduleStore after success', async () => {
    const newCycle = { id: 42, year: 2026, number: 1 };
    api.createCycle.mockResolvedValue(newCycle);
    api.fetchCycles.mockResolvedValue([]);

    const { result } = renderHook(() => useCreateCycle(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ year: 2026, courseCodes: [] });

    expect(useScheduleStore.getState().activeCycleId).toBe(42);
  });
});

describe('useDeleteCycle', () => {
  test('calls deleteCycle API with the given cycleId', async () => {
    api.deleteCycle.mockResolvedValue({ id: 1 });
    api.fetchCycles.mockResolvedValue([]);

    const { result } = renderHook(() => useDeleteCycle(), { wrapper: createWrapper() });

    await result.current.mutateAsync(1);

    expect(api.deleteCycle).toHaveBeenCalledWith(1);
  });
});

describe('useUpdateWeeks', () => {
  test('calls updateCycleWeeks with cycleId and weeks', async () => {
    const weeks = [{ week: 1, startDate: '2026-01-06', endDate: '2026-01-10' }];
    api.updateCycleWeeks.mockResolvedValue({ id: 1 });
    api.fetchCycles.mockResolvedValue([]);

    const { result } = renderHook(() => useUpdateWeeks(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ cycleId: 1, weeks });

    expect(api.updateCycleWeeks).toHaveBeenCalledWith(1, weeks);
  });
});

describe('useUpdateCourseCodes', () => {
  test('calls updateCourseCodes with cycleId and courseCodes', async () => {
    api.updateCourseCodes.mockResolvedValue({ id: 1 });
    api.fetchCycles.mockResolvedValue([]);

    const { result } = renderHook(() => useUpdateCourseCodes(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ cycleId: 1, courseCodes: ['NDC', 'ROADMAP'] });

    expect(api.updateCourseCodes).toHaveBeenCalledWith(1, ['NDC', 'ROADMAP']);
  });
});

// ---------------------------------------------------------------------------
// useGrid
// ---------------------------------------------------------------------------

describe('useGrid', () => {
  test('does not fetch when cycleId is falsy', () => {
    api.fetchGrid.mockResolvedValue({ grid: [] });

    renderHook(() => useGrid(null, { shift: 'AM', labType: 'REGULAR', side: 'ALL' }), {
      wrapper: createWrapper(),
    });

    // enabled: false — query should not fire
    expect(api.fetchGrid).not.toHaveBeenCalled();
  });

  test('fetches grid data with correct params when cycleId is set', async () => {
    const mockGrid = { cycleId: 1, grid: [{ stationId: 10, station: 'A-1', availability: ['✓'] }] };
    api.fetchGrid.mockResolvedValue(mockGrid);

    const filters = { shift: 'PM', labType: 'PRE_EXAM', side: 'LH' };
    const { result } = renderHook(() => useGrid(1, filters), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.fetchGrid).toHaveBeenCalledWith(1, 'PM', 'PRE_EXAM', 'LH');
    expect(result.current.data).toEqual(mockGrid);
  });
});

// ---------------------------------------------------------------------------
// useBookings
// ---------------------------------------------------------------------------

describe('useBookSlot', () => {
  test('calls bookSlot API with the provided params', async () => {
    const bookingParams = {
      cycleId: 1,
      stationId: 10,
      shift: 'AM',
      weeks: [1, 2],
      traineeName: 'Alice',
      contactId: 'hub-1',
    };
    api.bookSlot.mockResolvedValue({ data: 'ok' });

    const { result } = renderHook(() => useBookSlot(), { wrapper: createWrapper() });

    await result.current.mutateAsync(bookingParams);

    expect(api.bookSlot).toHaveBeenCalledWith(bookingParams);
  });
});

describe('useUnbookSlot', () => {
  test('calls unbookSlot API with the provided params', async () => {
    const unbookParams = { cycleId: 1, stationId: 10, shift: 'AM', weeks: [1] };
    api.unbookSlot.mockResolvedValue({ data: 'ok' });

    const { result } = renderHook(() => useUnbookSlot(), { wrapper: createWrapper() });

    await result.current.mutateAsync(unbookParams);

    expect(api.unbookSlot).toHaveBeenCalledWith(unbookParams);
  });
});

describe('useFindCombinations', () => {
  test('calls findCombinations API with search params', async () => {
    const searchParams = {
      cycleId: 1,
      shift: 'AM',
      labType: 'REGULAR',
      side: 'ALL',
      startWeek: 1,
      endWeek: 12,
      weeksNeeded: 3,
    };
    const mockResult = [{ stationId: 5, weeks: [2, 3, 4] }];
    api.findCombinations.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useFindCombinations(), { wrapper: createWrapper() });

    const data = await result.current.mutateAsync(searchParams);

    expect(api.findCombinations).toHaveBeenCalledWith(searchParams);
    expect(data).toEqual(mockResult);
  });
});

// ---------------------------------------------------------------------------
// useContacts
// ---------------------------------------------------------------------------

describe('useContactSearch', () => {
  test('does not fetch when query is shorter than 2 characters', () => {
    api.searchContacts.mockResolvedValue([]);

    renderHook(() => useContactSearch('A'), { wrapper: createWrapper() });

    expect(api.searchContacts).not.toHaveBeenCalled();
  });

  test('fetches contacts when query length >= 2', async () => {
    const mockContacts = [{ id: 'hub-1', fullName: 'Alice Nguyen', email: 'alice@example.com' }];
    api.searchContacts.mockResolvedValue(mockContacts);

    const { result } = renderHook(() => useContactSearch('Al'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.searchContacts).toHaveBeenCalledWith('Al');
    expect(result.current.data).toEqual(mockContacts);
  });
});

describe('useContact', () => {
  test('does not fetch when contactId is falsy', () => {
    api.getContactById.mockResolvedValue(null);

    renderHook(() => useContact(null), { wrapper: createWrapper() });

    expect(api.getContactById).not.toHaveBeenCalled();
  });

  test('fetches contact by id when contactId is provided', async () => {
    const mockContact = { id: 'hub-99', fullName: 'Bob Smith' };
    api.getContactById.mockResolvedValue(mockContact);

    const { result } = renderHook(() => useContact('hub-99'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getContactById).toHaveBeenCalledWith('hub-99');
    expect(result.current.data).toEqual(mockContact);
  });
});

// ---------------------------------------------------------------------------
// useRegistration
// ---------------------------------------------------------------------------

describe('useRegistrationList', () => {
  test('does not fetch when cycleId or shift is falsy', () => {
    api.fetchRegistrationList.mockResolvedValue([]);

    renderHook(() => useRegistrationList(null, 'AM'), { wrapper: createWrapper() });
    renderHook(() => useRegistrationList(1, null), { wrapper: createWrapper() });

    expect(api.fetchRegistrationList).not.toHaveBeenCalled();
  });

  test('fetches registration list with correct cycleId and shift', async () => {
    const mockList = [{ contactId: 'c1', firstName: 'Tom', lastName: 'Lee' }];
    api.fetchRegistrationList.mockResolvedValue(mockList);

    const { result } = renderHook(() => useRegistrationList(5, 'PM'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.fetchRegistrationList).toHaveBeenCalledWith(5, 'PM');
    expect(result.current.data).toEqual(mockList);
  });
});

describe('useRefreshRegistration', () => {
  test('calls fetchRegistrationList with refresh=true flag', async () => {
    const mockList = [{ contactId: 'c1', firstName: 'Tom' }];
    api.fetchRegistrationList.mockResolvedValue(mockList);

    const { result } = renderHook(() => useRefreshRegistration(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ cycleId: 5, shift: 'AM' });

    // The hook passes refresh=true as the third arg
    expect(api.fetchRegistrationList).toHaveBeenCalledWith(5, 'AM', true);
  });
});

// ---------------------------------------------------------------------------
// useAnalytics
// ---------------------------------------------------------------------------

describe('useSeatingAnalytics', () => {
  test('does not fetch when year is falsy', () => {
    api.fetchSeatingAnalytics.mockResolvedValue({});

    renderHook(() => useSeatingAnalytics(null, null), { wrapper: createWrapper() });

    expect(api.fetchSeatingAnalytics).not.toHaveBeenCalled();
  });

  test('fetches seating analytics with year param', async () => {
    const mockData = { summary: { totalBooked: 45 }, weekOccupancy: [] };
    api.fetchSeatingAnalytics.mockResolvedValue(mockData);

    const { result } = renderHook(() => useSeatingAnalytics(2026, null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.fetchSeatingAnalytics).toHaveBeenCalledWith(2026, null);
    expect(result.current.data).toEqual(mockData);
  });

  test('passes cycleId when provided', async () => {
    api.fetchSeatingAnalytics.mockResolvedValue({});

    const { result } = renderHook(() => useSeatingAnalytics(2026, 3), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.fetchSeatingAnalytics).toHaveBeenCalledWith(2026, 3);
  });
});

describe('useRegistrationAnalytics', () => {
  test('does not fetch when year or shift is falsy', () => {
    api.fetchRegistrationAnalytics.mockResolvedValue({});

    renderHook(() => useRegistrationAnalytics(null, 'AM', null), { wrapper: createWrapper() });
    renderHook(() => useRegistrationAnalytics(2026, null, null), { wrapper: createWrapper() });

    expect(api.fetchRegistrationAnalytics).not.toHaveBeenCalled();
  });

  test('fetches registration analytics with year and shift', async () => {
    const mockData = { totalStudents: 30, paymentDistribution: [] };
    api.fetchRegistrationAnalytics.mockResolvedValue(mockData);

    const { result } = renderHook(() => useRegistrationAnalytics(2026, 'AM', null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.fetchRegistrationAnalytics).toHaveBeenCalledWith(2026, 'AM', null);
    expect(result.current.data).toEqual(mockData);
  });

  test('passes cycleId when provided', async () => {
    api.fetchRegistrationAnalytics.mockResolvedValue({});

    const { result } = renderHook(() => useRegistrationAnalytics(2026, 'PM', 7), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.fetchRegistrationAnalytics).toHaveBeenCalledWith(2026, 'PM', 7);
  });
});
