import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchCriteriaForm from '../../components/SearchCriteriaForm';
import { useScheduleStore } from '../../stores/scheduleStore';

beforeEach(() => {
  useScheduleStore.getState().reset();
  vi.clearAllMocks();
});

describe('SearchCriteriaForm', () => {
  test('renders form with default values', () => {
    render(<SearchCriteriaForm onSearch={vi.fn()} isLoading={false} />);

    expect(screen.getByLabelText(/start week/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end week/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/consecutive weeks needed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find availability/i })).toBeInTheDocument();
  });

  test('calls onSearch on submit', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchCriteriaForm onSearch={onSearch} isLoading={false} />);

    await user.click(screen.getByRole('button', { name: /find availability/i }));

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledTimes(1);
    });
  });

  test('shows disabled button when loading', () => {
    render(<SearchCriteriaForm onSearch={vi.fn()} isLoading={true} />);

    const button = screen.getByRole('button', { name: /searching\.\.\./i });
    expect(button).toBeDisabled();
  });

  test('syncs values to store on change', async () => {
    const user = userEvent.setup();
    render(<SearchCriteriaForm onSearch={vi.fn()} isLoading={false} />);

    const startWeekSelect = screen.getByLabelText(/start week/i);
    await user.selectOptions(startWeekSelect, '3');

    await waitFor(() => {
      expect(useScheduleStore.getState().searchCriteria.startWeek).toBe(3);
    });
  });
});
