import type { Role } from "@repo/crm-db/client";

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        id: string;
        name: string;
        role: Role;
        mustChangePassword: boolean;
      };
    }
  }
}

export {};
