import type { Request, Response, NextFunction } from 'express';
import type Joi from 'joi';

const validate =
  (schema: Joi.ObjectSchema, source: 'body' | 'params' | 'query' = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const details: Record<string, string> = {};
      for (const item of error.details) {
        const key = item.path.reduce<string>((acc, part, i) => {
          if (typeof part === 'number') return `${acc}[${part}]`;
          return i === 0 ? String(part) : `${acc}.${part}`;
        }, '');
        details[key] = item.message.replace(/['"]/g, '');
      }
      return res.status(400).json({ error: 'Validation failed.', details });
    }
    (req as unknown as Record<string, unknown>)[source] = value;
    next();
  };

export = validate;
