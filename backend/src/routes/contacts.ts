import { Router, Request, Response, NextFunction } from 'express';
import validate from '../middleware/validate';
import respond from '../middleware/respond';
import * as schema from '../schemas/contacts';
import hubspot from '../hubspot';

const router = Router();

router.get(
  '/contacts/search',
  validate(schema.searchQuery, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query.q as string;
      const limit = Number(req.query.limit);
      const results = (await hubspot.searchContacts(q, limit)) as unknown[];
      respond.list(res, results, 'Contacts found.');
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/contacts/:id',
  validate(schema.idParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contact = await hubspot.getContactById(req.params['id'] as string);
      respond.ok(res, contact, 'Contact fetched.');
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/contacts/:id/payment-status',
  validate(schema.idParam, 'params'),
  validate(schema.updatePaymentStatus),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentStatus } = req.body as { paymentStatus: string };
      const result = await hubspot.updateContactPaymentStatus(
        req.params['id'] as string,
        paymentStatus,
      );
      respond.ok(res, result, 'Payment status updated.');
    } catch (err) {
      next(err);
    }
  },
);

export default router;
