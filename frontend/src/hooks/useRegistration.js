import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRegistrationList } from '../api';

export function useRegistrationList(cycleId, shift, options = {}) {
  return useQuery({
    queryKey: ['registration', cycleId, shift],
    queryFn: () => fetchRegistrationList(cycleId, shift),
    enabled: !!cycleId && !!shift,
    staleTime: 60_000,
    ...options,
  });
}

export function useRefreshRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cycleId, shift }) => fetchRegistrationList(cycleId, shift, true),
    onSuccess: (data, { cycleId, shift }) => {
      queryClient.setQueryData(['registration', cycleId, shift], data);
    },
  });
}
