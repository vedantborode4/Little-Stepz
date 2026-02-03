import { Request, Response, NextFunction } from "express";
import { Role } from "@repo/db/client";

export const roleMiddleware =
    (...allowedRoles: Role[]) =>
    (req: Request, res: Response, next: NextFunction) => {
    
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: "Forbidden" })
        }

        next()
    };


export const isAdmin = roleMiddleware(Role.ADMIN)

export const isAffiliate = roleMiddleware(Role.AFFILIATE)