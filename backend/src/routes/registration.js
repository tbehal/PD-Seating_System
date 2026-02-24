const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const respond = require('../middleware/respond');
const schema = require('../schemas/registration');
const registrationService = require('../services/registrationService');

router.get('/:cycleId/registration',
  validate(schema.registrationParams, 'params'),
  validate(schema.registrationQuery, 'query'),
  async (req, res, next) => {
    try {
      const result = await registrationService.getRegistrationList(
        req.params.cycleId, req.query.shift, req.query.refresh === 'true'
      );
      respond.ok(res, result, 'Registration list fetched.');
    } catch (err) { next(err); }
  }
);

router.get('/:cycleId/registration/export',
  validate(schema.registrationParams, 'params'),
  validate(schema.exportQuery, 'query'),
  async (req, res, next) => {
    try {
      const { csv, cycleName } = await registrationService.exportRegistrationCsv(
        req.params.cycleId, req.query.shift
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${cycleName}-${req.query.shift}-registration.csv"`);
      res.send(csv);
    } catch (err) { next(err); }
  }
);

module.exports = router;
