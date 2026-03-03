import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCycles,
  createCycle,
  deleteCycle,
  lockCycle,
  unlockCycle,
  updateCycleWeeks,
  updateCourseCodes,
} from '../api';
import { useScheduleStore } from '../stores/scheduleStore';

export function useCycles(options = {}) {
  return useQuery({
    queryKey: ['cycles'],
    queryFn: fetchCycles,
    ...options,
  });
}

export function useCreateCycle() {
  const queryClient = useQueryClient();
  const setActiveCycleId = useScheduleStore((s) => s.setActiveCycleId);

  return useMutation({
    mutationFn: ({ year, courseCodes }) => createCycle(year, courseCodes),
    onSuccess: (newCycle) => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      setActiveCycleId(newCycle.id);
    },
  });
}

export function useDeleteCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cycleId) => deleteCycle(cycleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
    },
  });
}

export function useLockCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cycleId) => lockCycle(cycleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
    },
  });
}

export function useUnlockCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cycleId) => unlockCycle(cycleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
    },
  });
}

export function useUpdateWeeks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cycleId, weeks }) => updateCycleWeeks(cycleId, weeks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      queryClient.invalidateQueries({ queryKey: ['grid'] });
    },
  });
}

export function useUpdateCourseCodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cycleId, courseCodes }) => updateCourseCodes(cycleId, courseCodes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      queryClient.invalidateQueries({ queryKey: ['registration'] });
    },
  });
}
