declare module 'express-serve-static-core' {
  interface Request {
    user?: { role: string; iat: number; exp: number };
  }
}

export {};
