const Joi = require('joi');

const book = Joi.object({
  cycleId: Joi.number().integer().positive().required(),
  stationId: Joi.number().integer().positive().required(),
  shift: Joi.string().valid('AM', 'PM').required(),
  weeks: Joi.array().items(Joi.number().integer().min(1).max(12)).min(1).required(),
  traineeName: Joi.string()
    .trim()
    .min(1)
    .max(150)
    .pattern(/^[\p{L}\p{M}\p{N}\s\-'.]+$/u)
    .required()
    .messages({
      'string.pattern.base': 'Trainee name contains invalid characters.',
    }),
  contactId: Joi.string().allow(null, '').optional(),
});

const unbook = Joi.object({
  cycleId: Joi.number().integer().positive().required(),
  stationId: Joi.number().integer().positive().required(),
  shift: Joi.string().valid('AM', 'PM').required(),
  weeks: Joi.array().items(Joi.number().integer().min(1).max(12)).min(1).required(),
});

const find = Joi.object({
  cycleId: Joi.number().integer().positive().required(),
  shift: Joi.string().valid('AM', 'PM').required(),
  labType: Joi.string().trim().required(),
  side: Joi.string().trim().required(),
  startWeek: Joi.number().integer().min(1).max(12).required(),
  endWeek: Joi.number().integer().min(1).max(12).required(),
  weeksNeeded: Joi.number().integer().min(1).max(12).required(),
})
  .custom((value, helpers) => {
    if (value.startWeek > value.endWeek) {
      return helpers.error('any.invalid');
    }
    if (value.weeksNeeded > value.endWeek - value.startWeek + 1) {
      return helpers.error('any.invalid');
    }
    return value;
  })
  .messages({
    'any.invalid': 'startWeek must be <= endWeek and weeksNeeded must fit within the range.',
  });

const reset = Joi.object({
  cycleId: Joi.number().integer().positive().required(),
});

module.exports = { book, unbook, find, reset };
