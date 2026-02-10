import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

declare module 'express' {
  interface Request {
    cartIdentifier?: { type: 'user' | 'session'; id: string };
  }
}

export const cartMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    req.cartIdentifier = { type: 'user', id: req.user.userId };
  } else {
    let sessionId = req.cookies.cartSession;
    if (!sessionId) {
      sessionId = randomUUID();
      res.cookie('cartSession', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }
    req.cartIdentifier = { type: 'session', id: sessionId };
  }
  next();
};
