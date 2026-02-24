const Joi = require('joi');

const grid = Joi.object({
  cycleId: Joi.number().integer().positive().required(),
  shift: Joi.string().valid('AM', 'PM').required(),
  labType: Joi.string().trim().required(),
  side: Joi.string().trim().required(),
});

const exportQuery = Joi.object({
  cycleId: Joi.number().integer().positive().required(),
  shift: Joi.string().valid('AM', 'PM').required(),
  labType: Joi.string().trim().required(),
  side: Joi.string().trim().required(),
});

module.exports = { grid, exportQuery };
