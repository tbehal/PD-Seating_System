import { Router, Request, Response, NextFunction } from 'express';
import validate from '../middleware/validate';
import respond from '../middleware/respond';
import * as schema from '../schemas/grid';
import * as gridService from '../services/gridService';

const router = Router();

router.post(
  '/grid',
  validate(schema.grid),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cycleId, shift, labType, side } = req.body as {
        cycleId: number;
        shift: string;
        labType: string;
        side: string;
      };
      const data = await gridService.buildGrid(cycleId, shift, labType, side);
      respond.ok(res, data, 'Grid fetched.');
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/export',
  validate(schema.exportQuery, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycleId = Number(req.query.cycleId);
      const shift = req.query.shift as string;
      const labType = req.query.labType as string;
      const side = req.query.side as string;
      const csv = await gridService.exportGrid(cycleId, shift, labType, side);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cycle-${cycleId}-${shift}-${labType}-export.csv"`,
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
