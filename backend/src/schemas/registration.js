const Joi = require('joi');

const registrationParams = Joi.object({
  cycleId: Joi.number().integer().positive().required(),
});

const registrationQuery = Joi.object({
  shift: Joi.string().uppercase().valid('AM', 'PM').default('AM'),
  refresh: Joi.string().valid('true').optional(),
});

const exportQuery = Joi.object({
  shift: Joi.string().uppercase().valid('AM', 'PM').default('AM'),
});

module.exports = { registrationParams, registrationQuery, exportQuery };
