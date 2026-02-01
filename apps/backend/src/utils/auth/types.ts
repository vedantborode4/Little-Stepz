import { Role } from "@repo/db/client";

export interface AccessTokenPayload {
  userId: string;
  role: Role;
}
