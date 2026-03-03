import { Router, Request, Response, NextFunction } from 'express';
import validate from '../middleware/validate';
import respond from '../middleware/respond';
import * as schema from '../schemas/analytics';
import * as analyticsService from '../services/analyticsService';

const router = Router();

router.get(
  '/seating',
  validate(schema.seatingQuery, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = Number(req.query.year);
      const cycleId = req.query.cycleId ? Number(req.query.cycleId) : null;
      const result = await analyticsService.getSeatingAnalytics(year, cycleId);
      respond.ok(res, result, 'Seating analytics fetched.');
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/registration',
  validate(schema.registrationQuery, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = Number(req.query.year);
      const shift = req.query.shift as string;
      const cycleId = req.query.cycleId ? Number(req.query.cycleId) : null;
      const result = await analyticsService.getRegistrationAnalytics(year, shift, cycleId);
      respond.ok(res, result, 'Registration analytics fetched.');
    } catch (err) {
      next(err);
    }
  },
);

export default router;
