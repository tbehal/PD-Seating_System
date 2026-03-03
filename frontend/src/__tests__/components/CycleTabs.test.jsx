import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CycleTabs from '../../components/CycleTabs';

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

const cycles = [
  { id: 1, name: 'Cycle 1 - 2026', locked: false },
  { id: 2, name: 'Cycle 2 - 2026', locked: true },
];

const defaultProps = {
  cycles,
  activeCycleId: 1,
  onSelectCycle: vi.fn(),
  onCreateCycle: vi.fn(),
  onDeleteCycle: vi.fn(),
  onLockCycle: vi.fn(),
  onUnlockCycle: vi.fn(),
};

describe('CycleTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders cycle tabs', () => {
    render(<CycleTabs {...defaultProps} />);

    expect(screen.getByText('Cycle 1 - 2026')).toBeInTheDocument();
    expect(screen.getByText('Cycle 2 - 2026')).toBeInTheDocument();
  });

  test('highlights active tab', () => {
    render(<CycleTabs {...defaultProps} activeCycleId={1} />);

    const activeTab = screen.getByText('Cycle 1 - 2026').closest('button');
    const inactiveTab = screen.getByText('Cycle 2 - 2026').closest('button');

    expect(activeTab).toHaveAttribute('aria-selected', 'true');
    expect(inactiveTab).toHaveAttribute('aria-selected', 'false');
  });

  test('shows lock icon for locked cycles', () => {
    render(<CycleTabs {...defaultProps} />);

    // Cycle 2 is locked — its tab button contains the lock icon
    const lockedTabButton = screen.getByRole('button', {
      name: /toggle lock for Cycle 2 - 2026/i,
    });
    expect(lockedTabButton.querySelector('[data-testid="lock-icon"]')).toBeInTheDocument();

    // Cycle 1 is unlocked — no lock icon inside its tab button
    const unlockedTabButton = screen.getByRole('button', {
      name: /toggle lock for Cycle 1 - 2026/i,
    });
    expect(unlockedTabButton.querySelector('[data-testid="lock-icon"]')).toBeNull();
  });

  test('opens create dialog on + click', async () => {
    const user = userEvent.setup();
    render(<CycleTabs {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /create new cycle/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create New Cycle')).toBeInTheDocument();
  });

  test('opens delete confirmation on X click', async () => {
    const user = userEvent.setup();
    render(<CycleTabs {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete Cycle 1 - 2026/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Delete Cycle')).toBeInTheDocument();
    // Confirmation message inside the dialog contains the cycle name
    expect(within(dialog).getByText(/Cycle 1 - 2026/)).toBeInTheDocument();
  });

  test('submits create cycle form with year and course codes', async () => {
    const user = userEvent.setup();
    defaultProps.onCreateCycle.mockResolvedValue();
    render(<CycleTabs {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /create new cycle/i }));

    const yearInput = screen.getByLabelText(/year/i);
    await user.clear(yearInput);
    await user.type(yearInput, '2026');

    const codesTextarea = screen.getByLabelText(/course codes/i);
    await user.type(codesTextarea, 'NDC-26-Mis1-Clinical-AM');

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^create$/i }));

    expect(defaultProps.onCreateCycle).toHaveBeenCalledWith(2026, ['NDC-26-Mis1-Clinical-AM']);
  });

  test('cancels create cycle dialog without calling callback', async () => {
    const user = userEvent.setup();
    render(<CycleTabs {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /create new cycle/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(defaultProps.onCreateCycle).not.toHaveBeenCalled();
  });

  test('confirms delete cycle and calls callback', async () => {
    const user = userEvent.setup();
    defaultProps.onDeleteCycle.mockResolvedValue();
    render(<CycleTabs {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete Cycle 1 - 2026/i }));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    expect(defaultProps.onDeleteCycle).toHaveBeenCalledWith(1);
  });

  test('cancels delete cycle dialog without calling callback', async () => {
    const user = userEvent.setup();
    render(<CycleTabs {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete Cycle 1 - 2026/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(defaultProps.onDeleteCycle).not.toHaveBeenCalled();
  });
});
