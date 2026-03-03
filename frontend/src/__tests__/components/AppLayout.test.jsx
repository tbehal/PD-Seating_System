import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, resetStores } from '../test-utils';
import AppLayout from '../../components/AppLayout';

vi.mock('../../api', () => ({
  checkAuth: vi.fn().mockResolvedValue(true),
  logout: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../hooks/useCycles', () => ({
  useCycles: vi.fn(() => ({ data: [] })),
  useCreateCycle: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useDeleteCycle: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useLockCycle: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUnlockCycle: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('../../components/CycleTabs', () => ({
  default: () => <div data-testid="cycle-tabs">CycleTabs</div>,
}));

vi.mock('../../components/DarkModeToggle', () => ({
  DarkModeToggle: () => <div data-testid="dark-mode-toggle">Toggle</div>,
}));

vi.mock('../../components/ui/Skeleton', () => ({
  Skeleton: ({ className }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

beforeEach(() => {
  resetStores();
  vi.clearAllMocks();
});

describe('AppLayout', () => {
  test('redirects when unauthenticated', () => {
    renderWithProviders(<AppLayout />, { authenticated: false, route: '/schedule' });

    expect(screen.queryByText('Lab Availability Manager')).not.toBeInTheDocument();
  });

  test('renders nav when authenticated', () => {
    renderWithProviders(<AppLayout />, { authenticated: true, route: '/schedule' });

    expect(screen.getByText('Lab Availability Manager')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /registration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /analytics/i })).toBeInTheDocument();
  });

  test('renders CycleTabs when authenticated', () => {
    renderWithProviders(<AppLayout />, { authenticated: true, route: '/schedule' });

    expect(screen.getByTestId('cycle-tabs')).toBeInTheDocument();
  });

  test('shows skeleton while auth is loading', () => {
    renderWithProviders(<AppLayout />, { authenticated: null, route: '/schedule' });

    expect(screen.queryByText('Lab Availability Manager')).not.toBeInTheDocument();
    expect(screen.queryByText('Schedule')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });
});
