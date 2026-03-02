const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const respond = require('../middleware/respond');
const schema = require('../schemas/bookings');
const bookingService = require('../services/bookingService');

router.post('/book', validate(schema.book), async (req, res, next) => {
  try {
    const result = await bookingService.bookSlots(req.body);
    respond.ok(res, result, 'Slot(s) booked successfully.');
  } catch (err) {
    next(err);
  }
});

router.post('/unbook', validate(schema.unbook), async (req, res, next) => {
  try {
    const result = await bookingService.unbookSlots(req.body);
    respond.ok(res, result, 'Slot(s) unbooked successfully.');
  } catch (err) {
    next(err);
  }
});

router.post('/find', validate(schema.find), async (req, res, next) => {
  try {
    const results = await bookingService.findAvailableBlocks(req.body);
    respond.list(res, results, 'Available blocks found.');
  } catch (err) {
    next(err);
  }
});

router.post('/reset', validate(schema.reset), async (req, res, next) => {
  try {
    const result = await bookingService.resetCycle(req.body.cycleId);
    respond.ok(res, result, `All bookings for ${result.cycleName} have been cleared.`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
