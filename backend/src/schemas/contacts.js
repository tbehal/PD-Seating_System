const Joi = require('joi');

const searchQuery = Joi.object({
  q: Joi.string().trim().min(1).max(200).required(),
  limit: Joi.number().integer().min(1).max(50).default(10),
});

const idParam = Joi.object({
  id: Joi.string()
    .pattern(/^\d+$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid contact ID.' }),
});

const updatePaymentStatus = Joi.object({
  paymentStatus: Joi.string().trim().min(1).max(200).required(),
});

module.exports = { searchQuery, idParam, updatePaymentStatus };
