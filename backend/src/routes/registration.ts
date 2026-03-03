import { Router, Request, Response, NextFunction } from 'express';
import validate from '../middleware/validate';
import respond from '../middleware/respond';
import * as schema from '../schemas/registration';
import * as registrationService from '../services/registrationService';

const router = Router();

router.get(
  '/:cycleId/registration',
  validate(schema.registrationParams, 'params'),
  validate(schema.registrationQuery, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycleId = Number(req.params.cycleId);
      const shift = req.query.shift as string;
      const refresh = req.query.refresh as string | undefined;
      const result = await registrationService.getRegistrationList(
        cycleId,
        shift,
        refresh === 'true',
      );
      respond.ok(res, result, 'Registration list fetched.');
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:cycleId/registration/export',
  validate(schema.registrationParams, 'params'),
  validate(schema.exportQuery, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycleId = Number(req.params.cycleId);
      const shift = req.query.shift as string;
      const { csv, cycleName } = await registrationService.exportRegistrationCsv(cycleId, shift);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${cycleName}-${shift}-registration.csv"`,
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
