import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookSlot, unbookSlot, resetAllBookings, findCombinations } from '../api';

export function useBookSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params) => bookSlot(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grid'] });
    },
  });
}

export function useUnbookSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params) => unbookSlot(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grid'] });
    },
  });
}

export function useResetBookings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cycleId) => resetAllBookings(cycleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grid'] });
    },
  });
}

export function useFindCombinations() {
  return useMutation({
    mutationFn: (params) => findCombinations(params),
  });
}
