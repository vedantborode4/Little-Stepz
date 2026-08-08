export type Role = "USER" | "ADMIN" | "AFFILIATE";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  /** Returned to native clients only — persisted so refresh never depends on cookies. */
  refreshToken?: string;
}
