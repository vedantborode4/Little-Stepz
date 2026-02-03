import { randomBytes } from "crypto";
import { hashToken } from "./tokenHash";

const REFRESH_TOKEN_BYTES = Number(process.env.REFRESH_TOKEN_BYTES) || 64;
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;

export interface GeneratedRefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export const generateRefreshToken = async (): Promise<GeneratedRefreshToken> => {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

  return { token, tokenHash, expiresAt };
};
