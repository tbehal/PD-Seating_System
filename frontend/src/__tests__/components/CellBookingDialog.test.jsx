import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CellBookingDialog from '../../components/CellBookingDialog';

vi.mock('../../components/ContactSearch', () => ({
  default: ({ onContactSelect }) => (
    <div data-testid="contact-search">
      <button
        data-testid="select-contact"
        onClick={() =>
          onContactSelect({ id: 'hub-123', fullName: 'Jane Smith', email: 'jane@example.com' })
        }
      >
        Select Contact
      </button>
    </div>
  ),
}));

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CellBookingDialog', () => {
  test('returns null when dialog is null', () => {
    const { container } = render(
      <CellBookingDialog dialog={null} onSubmit={vi.fn()} onCancel={vi.fn()} isBooking={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('renders form when dialog provided', () => {
    const dialog = { stationLabel: 'Lab A-1', shift: 'AM', weeks: [1, 2] };
    render(
      <CellBookingDialog dialog={dialog} onSubmit={vi.fn()} onCancel={vi.fn()} isBooking={false} />,
    );

    expect(screen.getByRole('heading', { name: /book slots/i })).toBeInTheDocument();
    expect(screen.getByText('Lab A-1')).toBeInTheDocument();
    expect(screen.getByLabelText(/trainee name/i)).toBeInTheDocument();
  });

  test('submit button is disabled when trainee name is empty', () => {
    const dialog = { stationLabel: 'Lab A-1', shift: 'AM', weeks: [1] };
    render(
      <CellBookingDialog dialog={dialog} onSubmit={vi.fn()} onCancel={vi.fn()} isBooking={false} />,
    );

    // The Book Slot button is disabled when traineeName is empty (no trim value)
    const bookButton = screen.getByRole('button', { name: /book slot/i });
    expect(bookButton).toBeDisabled();
  });

  test('renders contact search component', () => {
    const dialog = { stationLabel: 'Lab A-1', shift: 'PM', weeks: [3] };
    render(
      <CellBookingDialog dialog={dialog} onSubmit={vi.fn()} onCancel={vi.fn()} isBooking={false} />,
    );

    expect(screen.getByTestId('contact-search')).toBeInTheDocument();
  });

  test('selecting a contact auto-fills trainee name and enables booking', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const dialog = { stationLabel: 'Lab A-1', shift: 'AM', weeks: [1] };

    render(
      <CellBookingDialog
        dialog={dialog}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        isBooking={false}
      />,
    );

    // Before selection — Book Slot button disabled, trainee input empty
    const bookButton = screen.getByRole('button', { name: /book slot/i });
    expect(bookButton).toBeDisabled();

    // Simulate selecting a contact via the mock
    await user.click(screen.getByTestId('select-contact'));

    // Trainee name input should now show the contact's fullName
    const traineeInput = screen.getByLabelText(/trainee name/i);
    expect(traineeInput).toHaveValue('Jane Smith');

    // Book button should now be enabled
    expect(bookButton).not.toBeDisabled();

    // Submitting should pass traineeName + contactId
    await user.click(bookButton);
    expect(onSubmit).toHaveBeenCalledWith({ traineeName: 'Jane Smith', contactId: 'hub-123' });
  });
});
