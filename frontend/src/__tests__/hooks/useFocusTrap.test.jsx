import React, { useRef } from 'react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

function TestDialog({ isActive, onEscape }) {
  const ref = useRef(null);
  useFocusTrap(ref, isActive, { onEscape });

  return (
    <div ref={ref} data-testid="dialog">
      <button data-testid="first">First</button>
      <input data-testid="middle" />
      <button data-testid="last">Last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  let rafSpy;

  beforeEach(() => {
    // Make requestAnimationFrame synchronous so focusFirst runs immediately
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    rafSpy.mockRestore();
  });

  test('does nothing when isActive is false', () => {
    render(<TestDialog isActive={false} onEscape={vi.fn()} />);

    const first = screen.getByTestId('first');
    first.focus();

    // Tab key fired on the dialog element — no trap, no focus move
    fireEvent.keyDown(screen.getByTestId('dialog'), {
      key: 'Tab',
      shiftKey: false,
    });

    // Focus should remain on first (hook never moved it)
    expect(document.activeElement).toBe(first);
  });

  test('traps Tab at last element — wraps to first', () => {
    render(<TestDialog isActive={true} onEscape={vi.fn()} />);

    const first = screen.getByTestId('first');
    const last = screen.getByTestId('last');

    // Manually place focus on last element
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(screen.getByTestId('dialog'), {
      key: 'Tab',
      shiftKey: false,
    });

    expect(document.activeElement).toBe(first);
  });

  test('traps Shift+Tab at first element — wraps to last', () => {
    render(<TestDialog isActive={true} onEscape={vi.fn()} />);

    const first = screen.getByTestId('first');
    const last = screen.getByTestId('last');

    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(screen.getByTestId('dialog'), {
      key: 'Tab',
      shiftKey: true,
    });

    expect(document.activeElement).toBe(last);
  });

  test('calls onEscape when Escape key is pressed', () => {
    const onEscape = vi.fn();
    render(<TestDialog isActive={true} onEscape={onEscape} />);

    fireEvent.keyDown(screen.getByTestId('dialog'), { key: 'Escape' });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  test('does not call onEscape when isActive is false', () => {
    const onEscape = vi.fn();
    render(<TestDialog isActive={false} onEscape={onEscape} />);

    fireEvent.keyDown(screen.getByTestId('dialog'), { key: 'Escape' });

    expect(onEscape).not.toHaveBeenCalled();
  });
});
