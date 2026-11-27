import { Request, Response, NextFunction } from "express";
import { TokenExpiredError, InvalidTokenError } from "../utils/auth/errors";
import { verifyAccessToken } from "../utils/auth/access-token";

function authenticate(req: Request, res: Response, next: NextFunction, allowGuest: boolean) {
  const token = req.cookies?.accessToken || req.header("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const payload = verifyAccessToken(token);

    if (payload.guest && !allowGuest) {
      return res.status(403).json({ message: "GUEST_SESSION_NOT_ALLOWED" });
    }

    req.user = {
      userId: payload.userId,
      role: payload.role,
      ...(payload.guest
        ? { guest: { since: new Date(payload.guest.since), orderId: payload.guest.orderId } }
        : {}),
    };

    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" });
    }

    if (err instanceof InvalidTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
}

/** Signed-in customers (and staff) only. Guest-checkout sessions are refused. */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  return authenticate(req, res, next, false);
}

/**
 * Also accepts a guest-checkout session. Only checkout-path routes opt in, and every
 * resource they address must go through the guest scope checks in guestScope.middleware.
 */
export function authOrGuestMiddleware(req: Request, res: Response, next: NextFunction) {
  return authenticate(req, res, next, true);
}

/** For a route on an `authOrGuestMiddleware` router that guests must not use. */
export function noGuestMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.user?.guest) {
    return res.status(403).json({ message: "GUEST_SESSION_NOT_ALLOWED" });
  }
  next();
}
