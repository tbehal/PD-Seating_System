const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const respond = require('../middleware/respond');
const schema = require('../schemas/contacts');
const hubspot = require('../hubspot');

router.get('/contacts/search', validate(schema.searchQuery, 'query'), async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    const results = await hubspot.searchContacts(q, limit);
    respond.list(res, results, 'Contacts found.');
  } catch (err) { next(err); }
});

router.get('/contacts/:id', validate(schema.idParam, 'params'), async (req, res, next) => {
  try {
    const contact = await hubspot.getContactById(req.params.id);
    respond.ok(res, contact, 'Contact fetched.');
  } catch (err) { next(err); }
});

router.patch('/contacts/:id/payment-status', validate(schema.idParam, 'params'), validate(schema.updatePaymentStatus), async (req, res, next) => {
  try {
    const { paymentStatus } = req.body;
    const result = await hubspot.updateContactPaymentStatus(req.params.id, paymentStatus);
    respond.ok(res, result, 'Payment status updated.');
  } catch (err) { next(err); }
});

module.exports = router;
