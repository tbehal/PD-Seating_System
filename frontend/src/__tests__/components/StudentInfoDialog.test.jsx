import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentInfoDialog from '../../components/StudentInfoDialog';

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// Base booking detail props shared by all non-null dialog scenarios
const baseDialog = {
  studentName: 'John Doe',
  stationLabel: 'Lab A-1',
  stationId: 10,
  shift: 'AM',
  week: 3,
  loading: false,
  hubspotContact: null,
};

describe('StudentInfoDialog', () => {
  test('renders null when dialog is null', () => {
    const { container } = render(
      <StudentInfoDialog dialog={null} onUnbook={vi.fn()} onClose={vi.fn()} locked={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('shows loading spinner when dialog.loading is true', () => {
    render(
      <StudentInfoDialog
        dialog={{ loading: true }}
        onUnbook={vi.fn()}
        onClose={vi.fn()}
        locked={false}
      />,
    );

    expect(screen.getByText(/loading hubspot data/i)).toBeInTheDocument();
    // Spinner element should be present (the animate-spin div)
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  test('shows booking details when dialog is loaded', () => {
    render(
      <StudentInfoDialog dialog={baseDialog} onUnbook={vi.fn()} onClose={vi.fn()} locked={false} />,
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Lab A-1')).toBeInTheDocument();
    expect(screen.getByText('AM')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('shows HubSpot contact info when hubspotContact is present', () => {
    const dialogWithContact = {
      ...baseDialog,
      hubspotContact: {
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-1234',
        studentId: 'STU-001',
        paymentStatus: 'Paid',
        lifeCycleStage: 'customer',
        deals: [],
      },
    };

    render(
      <StudentInfoDialog
        dialog={dialogWithContact}
        onUnbook={vi.fn()}
        onClose={vi.fn()}
        locked={false}
      />,
    );

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('555-1234')).toBeInTheDocument();
    expect(screen.getByText('STU-001')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('customer')).toBeInTheDocument();
  });

  test('renders deal entries when hubspotContact has deals', () => {
    const dialogWithDeals = {
      ...baseDialog,
      hubspotContact: {
        fullName: 'Jane Smith',
        email: null,
        phone: null,
        studentId: null,
        paymentStatus: 'Paid',
        lifeCycleStage: 'customer',
        deals: [
          {
            id: 'd1',
            stageName: 'Paid',
            properties: { dealname: 'NDC Package', amount: '1500', closedate: '2026-03-01' },
          },
        ],
      },
    };

    render(
      <StudentInfoDialog
        dialog={dialogWithDeals}
        onUnbook={vi.fn()}
        onClose={vi.fn()}
        locked={false}
      />,
    );

    expect(screen.getByText('NDC Package')).toBeInTheDocument();
    expect(screen.getByText('$1500')).toBeInTheDocument();
    // deals count badge: "Associated Deals (1)"
    expect(screen.getByText(/associated deals \(1\)/i)).toBeInTheDocument();
  });

  test('shows warning when no hubspotContact is found', () => {
    render(
      <StudentInfoDialog
        dialog={{ ...baseDialog, hubspotContact: null }}
        onUnbook={vi.fn()}
        onClose={vi.fn()}
        locked={false}
      />,
    );

    expect(screen.getByText(/no hubspot contact found for "john doe"/i)).toBeInTheDocument();
  });

  test('hides Remove Student button when locked is true', () => {
    render(
      <StudentInfoDialog dialog={baseDialog} onUnbook={vi.fn()} onClose={vi.fn()} locked={true} />,
    );

    expect(screen.queryByRole('button', { name: /remove student/i })).not.toBeInTheDocument();
  });

  test('shows Remove Student button when locked is false', () => {
    render(
      <StudentInfoDialog dialog={baseDialog} onUnbook={vi.fn()} onClose={vi.fn()} locked={false} />,
    );

    expect(screen.getByRole('button', { name: /remove student/i })).toBeInTheDocument();
  });

  test('calls onUnbook with correct args when Remove Student is clicked', async () => {
    const user = userEvent.setup();
    const onUnbook = vi.fn();

    render(
      <StudentInfoDialog
        dialog={baseDialog}
        onUnbook={onUnbook}
        onClose={vi.fn()}
        locked={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /remove student/i }));

    expect(onUnbook).toHaveBeenCalledTimes(1);
    expect(onUnbook).toHaveBeenCalledWith({
      stationId: 10,
      shift: 'AM',
      week: 3,
    });
  });

  test('calls onClose when Close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <StudentInfoDialog dialog={baseDialog} onUnbook={vi.fn()} onClose={onClose} locked={false} />,
    );

    await user.click(screen.getByRole('button', { name: /^close$/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when the X button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <StudentInfoDialog dialog={baseDialog} onUnbook={vi.fn()} onClose={onClose} locked={false} />,
    );

    await user.click(screen.getByRole('button', { name: /close dialog/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('dialog has correct accessibility attributes', () => {
    render(
      <StudentInfoDialog dialog={baseDialog} onUnbook={vi.fn()} onClose={vi.fn()} locked={false} />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
