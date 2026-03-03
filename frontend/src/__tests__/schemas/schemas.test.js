import { describe, test, expect } from 'vitest';
import { loginSchema } from '../../schemas/login';
import { searchCriteriaSchema } from '../../schemas/search';
import { bookingSchema } from '../../schemas/booking';
import { createCycleSchema } from '../../schemas/cycle';

describe('loginSchema', () => {
  test('accepts valid password', () => {
    const result = loginSchema.safeParse({ password: 'secret' });
    expect(result.success).toBe(true);
  });

  test('rejects empty password', () => {
    const result = loginSchema.safeParse({ password: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing password', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('searchCriteriaSchema', () => {
  test('accepts valid search criteria', () => {
    const result = searchCriteriaSchema.safeParse({
      startWeek: 1,
      endWeek: 12,
      weeksNeeded: 2,
    });
    expect(result.success).toBe(true);
  });

  test('rejects endWeek < startWeek', () => {
    const result = searchCriteriaSchema.safeParse({
      startWeek: 5,
      endWeek: 3,
      weeksNeeded: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('endWeek');
  });

  test('rejects out-of-range values', () => {
    const result = searchCriteriaSchema.safeParse({
      startWeek: 0,
      endWeek: 13,
      weeksNeeded: 1,
    });
    expect(result.success).toBe(false);
  });

  test('rejects non-integer', () => {
    const result = searchCriteriaSchema.safeParse({
      startWeek: 1.5,
      endWeek: 12,
      weeksNeeded: 2,
    });
    expect(result.success).toBe(false);
  });
});

describe('bookingSchema', () => {
  test('accepts valid traineeName', () => {
    const result = bookingSchema.safeParse({ traineeName: 'John' });
    expect(result.success).toBe(true);
  });

  test('rejects empty traineeName', () => {
    const result = bookingSchema.safeParse({ traineeName: '' });
    expect(result.success).toBe(false);
  });

  test('rejects traineeName > 150 chars', () => {
    const result = bookingSchema.safeParse({ traineeName: 'a'.repeat(151) });
    expect(result.success).toBe(false);
  });

  test('rejects whitespace-only trainee name', () => {
    const result = bookingSchema.safeParse({ traineeName: '   ' });
    expect(result.success).toBe(false);
  });
});

describe('createCycleSchema', () => {
  test('accepts valid year and defaults courseCodes to []', () => {
    const result = createCycleSchema.safeParse({ year: 2026 });
    expect(result.success).toBe(true);
    expect(result.data.courseCodes).toEqual([]);
  });

  test('rejects year < 2020', () => {
    const result = createCycleSchema.safeParse({ year: 2019 });
    expect(result.success).toBe(false);
  });

  test('accepts courseCodes array', () => {
    const result = createCycleSchema.safeParse({
      year: 2026,
      courseCodes: ['NDC-AM'],
    });
    expect(result.success).toBe(true);
    expect(result.data.courseCodes).toEqual(['NDC-AM']);
  });
});
