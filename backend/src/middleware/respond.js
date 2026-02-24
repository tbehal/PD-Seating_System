const respond = {
  ok(res, data, message = 'Success') {
    return res.json({ data, message });
  },
  list(res, items, message = 'Fetched') {
    return res.json({ data: items, count: items.length, message });
  },
  created(res, data, message = 'Created') {
    return res.status(201).json({ data, message });
  },
};

module.exports = respond;
