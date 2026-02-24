const request = require('supertest');
const app = require('../src/app');

describe('Auth API', () => {
  test('GET /api/health is public (200 without auth)', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);
    expect(res.body.status).toBe('ok');
  });

  test('Protected route returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/v1/cycles')
      .expect(401);
    expect(res.body.error).toMatch(/authentication/i);
  });

  test('POST /api/auth/login with correct password returns cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'admin123' })
      .expect(200);

    expect(res.body.data.authenticated).toBe(true);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/token=/);
    expect(cookies[0]).toMatch(/HttpOnly/i);
  });

  test('POST /api/auth/login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'wrongpassword' })
      .expect(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  test('GET /api/auth/check with valid cookie returns authenticated true', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ password: 'admin123' });

    const cookies = loginRes.headers['set-cookie'];

    const checkRes = await request(app)
      .get('/api/auth/check')
      .set('Cookie', cookies)
      .expect(200);

    expect(checkRes.body.data.authenticated).toBe(true);
  });
});
