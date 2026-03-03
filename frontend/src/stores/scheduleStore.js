import { create } from 'zustand';

export const useScheduleStore = create((set) => ({
  activeCycleId: null,
  filters: { shift: 'AM', labType: 'REGULAR', side: 'ALL' },
  searchCriteria: { startWeek: 1, endWeek: 12, weeksNeeded: 2 },
  selectedCombination: null,

  setActiveCycleId: (id) => set({ activeCycleId: id }),
  setFilters: (filters) => set({ filters }),
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  setSearchCriteria: (criteria) => set({ searchCriteria: criteria }),
  setSelectedCombination: (combo) => set({ selectedCombination: combo }),
  reset: () =>
    set({
      activeCycleId: null,
      filters: { shift: 'AM', labType: 'REGULAR', side: 'ALL' },
      searchCriteria: { startWeek: 1, endWeek: 12, weeksNeeded: 2 },
      selectedCombination: null,
    }),
}));
