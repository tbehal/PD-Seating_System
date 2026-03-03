import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, resetStores } from '../test-utils';
import LoginPage from '../../components/LoginPage';
import { useAuthStore } from '../../stores/authStore';

vi.mock('../../api', () => ({
  login: vi.fn(),
}));
import { login } from '../../api';

describe('LoginPage', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  test('renders login form', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('shows validation error on empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  test('calls login API and navigates on success', async () => {
    login.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('secret');
    });

    expect(useAuthStore.getState().authenticated).toBe(true);
  });

  test('shows server error on failed login', async () => {
    login.mockRejectedValue({ response: { data: { error: 'Invalid password' } } });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid password')).toBeInTheDocument();
    });
  });

  test('redirects if already authenticated', () => {
    renderWithProviders(<LoginPage />, { authenticated: true });

    // Navigate renders instead of the form — the form should not be present
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });
});
