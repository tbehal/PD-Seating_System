const request = require('supertest');
const app = require('../src/app');
const { getAuthCookie } = require('./helpers');

describe('Validation & Error Handling', () => {
  test('POST /api/v1/cycles with missing year returns 400 with field details', async () => {
    const res = await request(app)
      .post('/api/v1/cycles')
      .set('Cookie', getAuthCookie())
      .send({})
      .expect(400);

    expect(res.body.error).toBe('Validation failed.');
    expect(res.body.details).toBeDefined();
    expect(res.body.details.year).toBeDefined();
  });

  test('POST /api/v1/cycles with invalid year type returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/cycles')
      .set('Cookie', getAuthCookie())
      .send({ year: 'not-a-number' })
      .expect(400);

    expect(res.body.error).toBe('Validation failed.');
    expect(res.body.details.year).toBeDefined();
  });

  test('POST /api/v1/availability/book with missing fields returns 400 with details', async () => {
    const res = await request(app)
      .post('/api/v1/availability/book')
      .set('Cookie', getAuthCookie())
      .send({})
      .expect(400);

    expect(res.body.error).toBe('Validation failed.');
    expect(res.body.details).toBeDefined();
    expect(res.body.details.cycleId).toBeDefined();
    expect(res.body.details.stationId).toBeDefined();
    expect(res.body.details.shift).toBeDefined();
    expect(res.body.details.weeks).toBeDefined();
    expect(res.body.details.traineeName).toBeDefined();
  });

  test('POST /api/v1/availability/book with invalid shift returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/availability/book')
      .set('Cookie', getAuthCookie())
      .send({
        cycleId: 1,
        stationId: 1,
        shift: 'INVALID',
        weeks: [1],
        traineeName: 'Test',
      })
      .expect(400);

    expect(res.body.error).toBe('Validation failed.');
    expect(res.body.details.shift).toBeDefined();
  });

  test('GET /api/v1/cycles returns standard envelope with data array and count', async () => {
    const res = await request(app)
      .get('/api/v1/cycles')
      .set('Cookie', getAuthCookie())
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('message');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });

  test('PATCH /api/v1/cycles/999999/lock on nonexistent cycle returns 404', async () => {
    const res = await request(app)
      .patch('/api/v1/cycles/999999/lock')
      .set('Cookie', getAuthCookie())
      .expect(404);

    expect(res.body.error).toMatch(/not found/i);
  });

  test('POST /api/v1/availability/grid with missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/availability/grid')
      .set('Cookie', getAuthCookie())
      .send({ cycleId: 1 })
      .expect(400);

    expect(res.body.error).toBe('Validation failed.');
    expect(res.body.details.shift).toBeDefined();
    expect(res.body.details.labType).toBeDefined();
    expect(res.body.details.side).toBeDefined();
  });
});
