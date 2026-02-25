const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const respond = require('../middleware/respond');
const schema = require('../schemas/analytics');
const analyticsService = require('../services/analyticsService');

router.get('/seating',
  validate(schema.seatingQuery, 'query'),
  async (req, res, next) => {
    try {
      const result = await analyticsService.getSeatingAnalytics(
        req.query.year, req.query.cycleId || null
      );
      respond.ok(res, result, 'Seating analytics fetched.');
    } catch (err) { next(err); }
  }
);

router.get('/registration',
  validate(schema.registrationQuery, 'query'),
  async (req, res, next) => {
    try {
      const result = await analyticsService.getRegistrationAnalytics(
        req.query.year, req.query.shift, req.query.cycleId || null
      );
      respond.ok(res, result, 'Registration analytics fetched.');
    } catch (err) { next(err); }
  }
);

module.exports = router;
