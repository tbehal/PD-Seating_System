import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useScheduleStore } from '../stores/scheduleStore';
import { useThemeStore } from '../stores/themeStore';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function resetStores() {
  useAuthStore.setState({ authenticated: null });
  useScheduleStore.getState().reset();
  useThemeStore.setState({ theme: 'light' });
}

export function renderWithProviders(
  ui,
  {
    route = '/',
    queryClient = createTestQueryClient(),
    authenticated = null,
    ...renderOptions
  } = {},
) {
  if (authenticated !== undefined) {
    useAuthStore.setState({ authenticated });
  }

  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

export { createTestQueryClient };
export { toast } from 'sonner';
