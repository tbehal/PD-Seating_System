import Joi from 'joi';

const createCycle = Joi.object({
  year: Joi.number().integer().min(2020).max(2100).required(),
  courseCodes: Joi.array().items(Joi.string().trim().max(100)).optional(),
});

const updateWeeks = Joi.object({
  weeks: Joi.array()
    .items(
      Joi.object({
        week: Joi.number().integer().min(1).max(12).required(),
        startDate: Joi.date().iso().allow(null).optional(),
        endDate: Joi.date().iso().allow(null).optional(),
      }),
    )
    .min(1)
    .required(),
});

const updateCourseCodes = Joi.object({
  courseCodes: Joi.array().items(Joi.string().trim().max(100)).required(),
});

const idParam = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export { createCycle, updateWeeks, updateCourseCodes, idParam };
