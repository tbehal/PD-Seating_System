import { Router, Request, Response, NextFunction } from 'express';
import validate from '../middleware/validate';
import respond from '../middleware/respond';
import * as schema from '../schemas/bookings';
import * as bookingService from '../services/bookingService';
import type { BookSlotsInput, UnbookSlotsInput, FindBlocksInput } from '../types';

const router = Router();

router.post(
  '/book',
  validate(schema.book),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await bookingService.bookSlots(req.body as BookSlotsInput);
      respond.ok(res, result, 'Slot(s) booked successfully.');
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/unbook',
  validate(schema.unbook),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await bookingService.unbookSlots(req.body as UnbookSlotsInput);
      respond.ok(res, result, 'Slot(s) unbooked successfully.');
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/find',
  validate(schema.find),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await bookingService.findAvailableBlocks(req.body as FindBlocksInput);
      respond.list(res, results, 'Available blocks found.');
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/reset',
  validate(schema.reset),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cycleId } = req.body as { cycleId: number };
      const result = await bookingService.resetCycle(cycleId);
      respond.ok(res, result, `All bookings for ${result.cycleName} have been cleared.`);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
