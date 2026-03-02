const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const respond = require('../middleware/respond');
const schema = require('../schemas/cycles');
const cycleService = require('../services/cycleService');

router.get('/', async (req, res, next) => {
  try {
    const cycles = await cycleService.listCycles();
    respond.list(res, cycles, 'Cycles fetched.');
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(schema.createCycle), async (req, res, next) => {
  try {
    const { year, courseCodes } = req.body;
    const cycle = await cycleService.createCycle(year, courseCodes);
    respond.created(res, cycle, 'Cycle created.');
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/weeks',
  validate(schema.idParam, 'params'),
  validate(schema.updateWeeks),
  async (req, res, next) => {
    try {
      const updated = await cycleService.updateWeeks(req.params.id, req.body.weeks);
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
  async (req, res, next) => {
    try {
      const updated = await cycleService.updateCourseCodes(req.params.id, req.body.courseCodes);
      respond.ok(res, updated, 'Course codes updated.');
    } catch (err) {
      next(err);
    }
  },
);

router.patch('/:id/lock', validate(schema.idParam, 'params'), async (req, res, next) => {
  try {
    const cycle = await cycleService.setLocked(req.params.id, true);
    respond.ok(res, cycle, 'Cycle locked.');
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/unlock', validate(schema.idParam, 'params'), async (req, res, next) => {
  try {
    const cycle = await cycleService.setLocked(req.params.id, false);
    respond.ok(res, cycle, 'Cycle unlocked.');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validate(schema.idParam, 'params'), async (req, res, next) => {
  try {
    const cycle = await cycleService.deleteCycle(req.params.id);
    respond.ok(res, { name: cycle.name }, `${cycle.name} has been deleted.`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
