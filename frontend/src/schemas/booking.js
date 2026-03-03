import { z } from 'zod';

export const bookingSchema = z.object({
  traineeName: z.string().trim().min(1, 'Name is required').max(150, 'Name too long'),
  contactId: z.string().nullable().optional(),
});
