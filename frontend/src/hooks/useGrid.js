import { useQuery } from '@tanstack/react-query';
import { fetchGrid } from '../api';

export function useGrid(cycleId, filters) {
  return useQuery({
    queryKey: ['grid', cycleId, filters.shift, filters.labType, filters.side],
    queryFn: () => fetchGrid(cycleId, filters.shift, filters.labType, filters.side),
    enabled: !!cycleId,
  });
}
