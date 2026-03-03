import { z } from 'zod';

export const createCycleSchema = z.object({
  year: z.number().int().min(2020, 'Year must be 2020+').max(2100),
  courseCodes: z.array(z.string().min(1)).optional().default([]),
});
