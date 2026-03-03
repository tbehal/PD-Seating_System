import { z } from 'zod';

export const searchCriteriaSchema = z
  .object({
    startWeek: z.number().int().min(1).max(12),
    endWeek: z.number().int().min(1).max(12),
    weeksNeeded: z.number().int().min(1).max(12),
  })
  .refine((d) => d.endWeek >= d.startWeek, {
    message: 'End week must be >= start week',
    path: ['endWeek'],
  });
