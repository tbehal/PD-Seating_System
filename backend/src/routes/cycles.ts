import { Router, Request, Response, NextFunction } from 'express';
import validate from '../middleware/validate';
import respond from '../middleware/respond';
import * as schema from '../schemas/cycles';
import * as cycleService from '../services/cycleService';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cycles = await cycleService.listCycles();
    respond.list(res, cycles, 'Cycles fetched.');
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  validate(schema.createCycle),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { year, courseCodes } = req.body as { year: number; courseCodes?: string[] };
      const cycle = await cycleService.createCycle(year, courseCodes);
      respond.created(res, cycle, 'Cycle created.');
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id/weeks',
  validate(schema.idParam, 'params'),
  validate(schema.updateWeeks),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const { weeks } = req.body as {
        weeks: { week: number; startDate?: string | null; endDate?: string | null }[];
      };
      const updated = await cycleService.updateWeeks(id, weeks);
      respond.ok(res, updated, 'Week dates updated.');
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id/course-codes',
  validate(schema.idParam, 'params'),
  validate(schema.updateCourseCodes),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const { courseCodes } = req.body as { courseCodes: string[] };
      const updated = await cycleService.updateCourseCodes(id, courseCodes);
      respond.ok(res, updated, 'Course codes updated.');
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id/lock',
  validate(schema.idParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const cycle = await cycleService.setLocked(id, true);
      respond.ok(res, cycle, 'Cycle locked.');
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id/unlock',
  validate(schema.idParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const cycle = await cycleService.setLocked(id, false);
      respond.ok(res, cycle, 'Cycle unlocked.');
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  validate(schema.idParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const cycle = await cycleService.deleteCycle(id);
      respond.ok(res, { name: cycle.name }, `${cycle.name} has been deleted.`);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
