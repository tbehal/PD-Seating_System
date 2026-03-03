import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config';
import logger from '../logger';
import type { CookieOptions } from 'express';

const router = Router();

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    let isValid = false;

    if (config.adminPasswordHash) {
      isValid = await bcrypt.compare(password, config.adminPasswordHash);
    } else if (config.nodeEnv !== 'production') {
      isValid = password === 'admin123';
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    const token = jwt.sign({ role: 'admin' }, config.jwtSecret, { expiresIn: '8h' });
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ data: { authenticated: true }, message: 'Login successful.' });
  } catch (err) {
    logger.error({ err }, 'Login error');
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: 0 });
  res.json({ data: { authenticated: false }, message: 'Logged out.' });
});

router.get('/check', (req: Request, res: Response) => {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    return res.json({ data: { authenticated: false } });
  }

  try {
    jwt.verify(token, config.jwtSecret);
    res.json({ data: { authenticated: true } });
  } catch {
    res.json({ data: { authenticated: false } });
  }
});

export default router;
