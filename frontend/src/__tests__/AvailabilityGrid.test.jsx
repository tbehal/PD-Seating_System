import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import AvailabilityGrid from '../components/AvailabilityGrid';

// Minimal data fixture: 1 station, 2 weeks
function makeData({ weekDates = [], locked = false } = {}) {
  return {
    cycleId: 1,
    shift: 'AM',
    labType: 'REGULAR',
    side: 'ALL',
    locked,
    weeks: [1, 2],
    weekDates,
    grid: [
      {
        stationId: 1,
        station: 'Lab A-1',
        labName: 'Lab A',
        side: 'LH',
        availability: ['\u2713', '\u2713'],
      },
    ],
  };
}

const noop = () => {};

const defaultProps = {
  selectedCombination: null,
  onBookCell: noop,
  onUnbookMany: noop,
  onShowStudentInfo: noop,
  onExport: noop,
  onClearAll: noop,
  onUpdateWeekDates: noop,
};

describe('AvailabilityGrid', () => {
  test('renders "W1" with no date subtitle when dates are null', () => {
    render(
      <AvailabilityGrid
        data={makeData({
          weekDates: [
            { week: 1, startDate: null, endDate: null },
            { week: 2, startDate: null, endDate: null },
          ],
        })}
        locked={false}
        {...defaultProps}
      />,
    );

    // W1 header should exist
    expect(screen.getByText('W1')).toBeInTheDocument();
    // No date range subtitle should be rendered
    const w1Header = screen.getByText('W1').closest('th');
    const dateSubtitle = w1Header.querySelector('.text-xs');
    expect(dateSubtitle).toBeNull();
  });

  test('renders "W1" with "Jan 6-10" subtitle when dates are set', () => {
    render(
      <AvailabilityGrid
        data={makeData({
          weekDates: [
            { week: 1, startDate: '2026-01-06', endDate: '2026-01-10' },
            { week: 2, startDate: null, endDate: null },
          ],
        })}
        locked={false}
        {...defaultProps}
      />,
    );

    expect(screen.getByText('W1')).toBeInTheDocument();
    // The date range subtitle should appear
    expect(screen.getByText('Jan 6-Jan 10')).toBeInTheDocument();
  });

  test('clicking header when unlocked opens date popover', async () => {
    const user = userEvent.setup();
    render(
      <AvailabilityGrid
        data={makeData({
          weekDates: [
            { week: 1, startDate: null, endDate: null },
            { week: 2, startDate: null, endDate: null },
          ],
        })}
        locked={false}
        {...defaultProps}
      />,
    );

    // Click W1 header
    await user.click(screen.getByText('W1'));

    // Popover should now be visible with Start Date / End Date labels
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();
  });

  test('clicking header when locked does NOT open popover', async () => {
    const user = userEvent.setup();
    render(
      <AvailabilityGrid
        data={makeData({
          weekDates: [
            { week: 1, startDate: null, endDate: null },
            { week: 2, startDate: null, endDate: null },
          ],
        })}
        locked={true}
        {...defaultProps}
      />,
    );

    await user.click(screen.getByText('W1'));

    // Popover should NOT be rendered
    expect(screen.queryByLabelText('Start Date')).not.toBeInTheDocument();
  });

  test('popover has start/end inputs and Save/Cancel buttons', async () => {
    const user = userEvent.setup();
    render(
      <AvailabilityGrid
        data={makeData({
          weekDates: [
            { week: 1, startDate: null, endDate: null },
            { week: 2, startDate: null, endDate: null },
          ],
        })}
        locked={false}
        {...defaultProps}
      />,
    );

    await user.click(screen.getByText('W1'));

    expect(screen.getByLabelText('Start Date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('End Date')).toHaveAttribute('type', 'date');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  test('Save calls onUpdateWeekDates with correct args', async () => {
    const onUpdateWeekDates = vi.fn();
    const user = userEvent.setup();
    render(
      <AvailabilityGrid
        data={makeData({
          weekDates: [
            { week: 1, startDate: null, endDate: null },
            { week: 2, startDate: null, endDate: null },
          ],
        })}
        locked={false}
        {...defaultProps}
        onUpdateWeekDates={onUpdateWeekDates}
      />,
    );

    // Open popover for W1
    await user.click(screen.getByText('W1'));

    // Fill in dates
    const startInput = screen.getByLabelText('Start Date');
    const endInput = screen.getByLabelText('End Date');
    await user.type(startInput, '2026-01-06');
    await user.type(endInput, '2026-01-10');

    // Click Save
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdateWeekDates).toHaveBeenCalledWith(1, [
      { week: 1, startDate: '2026-01-06', endDate: '2026-01-10' },
    ]);
  });
});
