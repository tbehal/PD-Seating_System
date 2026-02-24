const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const respond = require('../middleware/respond');
const schema = require('../schemas/grid');
const gridService = require('../services/gridService');

router.post('/grid', validate(schema.grid), async (req, res, next) => {
  try {
    const { cycleId, shift, labType, side } = req.body;
    const data = await gridService.buildGrid(cycleId, shift, labType, side);
    respond.ok(res, data, 'Grid fetched.');
  } catch (err) { next(err); }
});

router.get('/export', validate(schema.exportQuery, 'query'), async (req, res, next) => {
  try {
    const { cycleId, shift, labType, side } = req.query;
    const csv = await gridService.exportGrid(cycleId, shift, labType, side);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="cycle-${cycleId}-${shift}-${labType}-export.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
