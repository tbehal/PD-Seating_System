const Joi = require('joi');

const seatingQuery = Joi.object({
  year: Joi.number().integer().min(2020).max(2100).required(),
  cycleId: Joi.number().integer().positive().optional(),
});

const registrationQuery = Joi.object({
  year: Joi.number().integer().min(2020).max(2100).required(),
  cycleId: Joi.number().integer().positive().optional(),
  shift: Joi.string().uppercase().valid('AM', 'PM', 'BOTH').required(),
});

module.exports = { seatingQuery, registrationQuery };
