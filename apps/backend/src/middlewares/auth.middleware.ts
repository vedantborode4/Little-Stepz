import { Request, Response, NextFunction } from "express";
import { TokenExpiredError, InvalidTokenError } from "../utils/auth/errors";
import { verifyAccessToken } from "../utils/auth/access-token";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    
    if (!token) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }
    
    try {
    const payload = verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      role: payload.role,
    }

    next()

  } catch (err) {

    if (err instanceof TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" })
    }

    if (err instanceof InvalidTokenError) {
      return res.status(401).json({ message: "Invalid token" })
    }

    return res.status(500).json({ message: "Internal server error" })
  }
}