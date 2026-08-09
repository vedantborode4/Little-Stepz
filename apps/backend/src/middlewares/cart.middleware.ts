import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { CART_SESSION_HEADER, isNativeClient } from "../utils/client";

declare module 'express' {
  interface Request {
    cartIdentifier?: { type: 'user' | 'session'; id: string };
  }
}

const cartSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

/**
 * Issue a guest cart session id: as a cookie (browsers) and, for native clients,
 * also as a response header they can persist themselves. React Native's cookie jar
 * is not durable across process death, so a cookie-only session silently loses the
 * guest's cart — and with it the merge-on-login.
 */
export function setCartSession(req: Request, res: Response, sessionId: string) {
  res.cookie('cartSession', sessionId, cartSessionCookieOptions);
  if (isNativeClient(req)) {
    res.setHeader(CART_SESSION_HEADER, sessionId);
  }
}

export const cartMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    req.cartIdentifier = { type: 'user', id: req.user.userId };
  } else {
    // Native clients hold their own session id (see setCartSession); the cookie is
    // still preferred when present so browser behaviour is unchanged.
    let sessionId: string | undefined = req.cookies?.cartSession;
    if (!sessionId && isNativeClient(req)) {
      sessionId = req.get(CART_SESSION_HEADER) || undefined;
    }
    if (!sessionId) {
      sessionId = randomUUID();
    }
    setCartSession(req, res, sessionId);
    req.cartIdentifier = { type: 'session', id: sessionId };
  }
  next();
};
