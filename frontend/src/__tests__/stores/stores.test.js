import { describe, test, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../stores/authStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useThemeStore } from '../../stores/themeStore';

beforeEach(() => {
  useAuthStore.setState({ authenticated: null });
  useScheduleStore.getState().reset();
  useThemeStore.setState({ theme: 'light' });
});

describe('authStore', () => {
  test('starts with authenticated as null', () => {
    expect(useAuthStore.getState().authenticated).toBeNull();
  });

  test('setAuthenticated updates value', () => {
    useAuthStore.getState().setAuthenticated(true);
    expect(useAuthStore.getState().authenticated).toBe(true);
  });

  test('can overwrite authenticated', () => {
    useAuthStore.getState().setAuthenticated(true);
    useAuthStore.getState().setAuthenticated(false);
    expect(useAuthStore.getState().authenticated).toBe(false);
  });
});

describe('scheduleStore', () => {
  test('has correct initial state', () => {
    const state = useScheduleStore.getState();
    expect(state.activeCycleId).toBeNull();
    expect(state.filters).toEqual({ shift: 'AM', labType: 'REGULAR', side: 'ALL' });
    expect(state.searchCriteria).toEqual({ startWeek: 1, endWeek: 12, weeksNeeded: 2 });
    expect(state.selectedCombination).toBeNull();
  });

  test('setActiveCycleId works', () => {
    useScheduleStore.getState().setActiveCycleId(5);
    expect(useScheduleStore.getState().activeCycleId).toBe(5);
  });

  test('setFilter updates single filter without touching others', () => {
    useScheduleStore.getState().setFilter('shift', 'PM');
    const { filters } = useScheduleStore.getState();
    expect(filters.shift).toBe('PM');
    expect(filters.labType).toBe('REGULAR');
    expect(filters.side).toBe('ALL');
  });

  test('setFilters replaces all filters', () => {
    useScheduleStore.getState().setFilters({ shift: 'PM', labType: 'PRE_EXAM', side: 'LH' });
    const { filters } = useScheduleStore.getState();
    expect(filters.shift).toBe('PM');
    expect(filters.labType).toBe('PRE_EXAM');
    expect(filters.side).toBe('LH');
  });

  test('setSelectedCombination works', () => {
    const combo = { stationId: 10, week: 3, shift: 'AM' };
    useScheduleStore.getState().setSelectedCombination(combo);
    expect(useScheduleStore.getState().selectedCombination).toEqual(combo);
  });

  test('reset restores initial state', () => {
    const store = useScheduleStore.getState();
    store.setActiveCycleId(99);
    store.setFilter('shift', 'PM');
    store.setSelectedCombination({ stationId: 1 });
    store.setSearchCriteria({ startWeek: 3, endWeek: 8, weeksNeeded: 4 });

    useScheduleStore.getState().reset();

    const state = useScheduleStore.getState();
    expect(state.activeCycleId).toBeNull();
    expect(state.filters).toEqual({ shift: 'AM', labType: 'REGULAR', side: 'ALL' });
    expect(state.searchCriteria).toEqual({ startWeek: 1, endWeek: 12, weeksNeeded: 2 });
    expect(state.selectedCombination).toBeNull();
  });
});

describe('themeStore', () => {
  test('starts with light theme after beforeEach reset', () => {
    expect(useThemeStore.getState().theme).toBe('light');
  });

  test('toggleTheme switches to dark', () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  test('setTheme sets specific theme', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});
