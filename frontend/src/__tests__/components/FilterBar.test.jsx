import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterBar from '../../components/FilterBar';
import { useScheduleStore } from '../../stores/scheduleStore';

describe('FilterBar', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useScheduleStore.getState().reset();
    vi.clearAllMocks();
  });

  test('renders all filter dropdowns', () => {
    render(<FilterBar />);

    expect(screen.getByLabelText(/shift/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lab type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/side/i)).toBeInTheDocument();
  });

  test('updates store on change', async () => {
    const user = userEvent.setup();
    render(<FilterBar />);

    const shiftSelect = screen.getByLabelText(/shift/i);
    await user.selectOptions(shiftSelect, 'PM');

    expect(useScheduleStore.getState().filters.shift).toBe('PM');
  });

  test('reflects store state in dropdown values', () => {
    // Set store state before rendering
    useScheduleStore.setState({
      filters: { shift: 'PM', labType: 'PRE_EXAM', side: 'RH' },
    });

    render(<FilterBar />);

    expect(screen.getByLabelText(/shift/i)).toHaveValue('PM');
    expect(screen.getByLabelText(/lab type/i)).toHaveValue('PRE_EXAM');
    expect(screen.getByLabelText(/side/i)).toHaveValue('RH');
  });
});
