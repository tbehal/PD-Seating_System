const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
  if (error) {
    const details = {};
    for (const item of error.details) {
      const key = item.path.reduce((acc, part, i) => {
        if (typeof part === 'number') return `${acc}[${part}]`;
        return i === 0 ? part : `${acc}.${part}`;
      }, '');
      details[key] = item.message.replace(/['"]/g, '');
    }
    return res.status(400).json({ error: 'Validation failed.', details });
  }
  req[source] = value;
  next();
};

module.exports = validate;
