import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import {
  InvalidTokenError,
  TokenExpiredError,
  TokenRevokedError,
} from "./errors";

const REFRESH_TOKEN_BYTES = Number(process.env.REFRESH_TOKEN_BYTES) || 64;
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;
const SALT_ROUNDS = Number(process.env.REFRESH_TOKEN_SALT_ROUNDS) || 12;

export interface GeneratedRefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export const generateRefreshToken = async (): Promise<GeneratedRefreshToken> => {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const tokenHash = await bcrypt.hash(token, SALT_ROUNDS);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

  return { token, tokenHash, expiresAt };
};

export const verifyRefreshToken = async (
  token: string,
  tokenHash: string,
  options?: {
    revoked?: boolean;
    expiresAt?: Date;
  }
): Promise<void> => {
  if (!token || !tokenHash) {
    throw new InvalidTokenError();
  }

  if (options?.revoked) {
    throw new TokenRevokedError();
  }

  if (options?.expiresAt && options.expiresAt < new Date()) {
    throw new TokenExpiredError();
  }

  const isValid = await bcrypt.compare(token, tokenHash);

  if (!isValid) {
    throw new InvalidTokenError();
  }
};