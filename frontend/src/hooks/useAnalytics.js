import { useQuery } from '@tanstack/react-query';
import { fetchSeatingAnalytics, fetchRegistrationAnalytics } from '../api';

export function useSeatingAnalytics(year, cycleId, options = {}) {
  return useQuery({
    queryKey: ['analytics', 'seating', year, cycleId],
    queryFn: () => fetchSeatingAnalytics(year, cycleId),
    enabled: !!year,
    ...options,
  });
}

export function useRegistrationAnalytics(year, shift, cycleId, options = {}) {
  return useQuery({
    queryKey: ['analytics', 'registration', year, shift, cycleId],
    queryFn: () => fetchRegistrationAnalytics(year, shift, cycleId),
    enabled: !!year && !!shift,
    ...options,
  });
}
