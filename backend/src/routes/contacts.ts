import { Router, Request, Response, NextFunction } from 'express';
import validate from '../middleware/validate';
import respond from '../middleware/respond';
import * as schema from '../schemas/contacts';
import hubspot from '../hubspot';
import AppError from '../lib/AppError';

const router = Router();

function ensureHubSpot(): void {
  if (!hubspot.apiKey) {
    throw new AppError(503, 'HubSpot API key not configured. Please set HUBSPOT_API_KEY.');
  }
}

/**
 * @openapi
 * /api/v1/availability/contacts/search:
 *   get:
 *     tags: [Contacts]
 *     summary: Search HubSpot contacts
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Matching contacts
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ListResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/NormalizedContact'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  '/contacts/search',
  validate(schema.searchQuery, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      ensureHubSpot();
      const q = req.query.q as string;
      const limit = Number(req.query.limit);
      const results = (await hubspot.searchContacts(q, limit)) as unknown[];
      respond.list(res, results, 'Contacts found.');
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/v1/availability/contacts/{id}:
 *   get:
 *     tags: [Contacts]
 *     summary: Get a single HubSpot contact by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact data
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/NormalizedContact'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/contacts/:id',
  validate(schema.idParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      ensureHubSpot();
      const contact = await hubspot.getContactById(req.params['id'] as string);
      respond.ok(res, contact, 'Contact fetched.');
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/v1/availability/contacts/{id}/payment-status:
 *   patch:
 *     tags: [Contacts]
 *     summary: Update payment status for a contact
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentStatus]
 *             properties:
 *               paymentStatus:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  '/contacts/:id/payment-status',
  validate(schema.idParam, 'params'),
  validate(schema.updatePaymentStatus),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      ensureHubSpot();
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
