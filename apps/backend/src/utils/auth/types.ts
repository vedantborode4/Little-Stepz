export enum Role {
  ADMIN,
  AFFILIATE,
  USER,
}

export interface AccessTokenPayload {
  userId: string;
  role: Role;
}
