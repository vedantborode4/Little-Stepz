import { randomBytes, randomInt } from "crypto";
import { hashToken } from "./tokenHash";

const RESET_TOKEN_BYTES = 32;
export const PASSWORD_RESET_TTL_MINUTES =
  Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 15;

/** A wrong code five times over burns the token; the user must request a new one. */
export const MAX_RESET_CODE_ATTEMPTS = 5;

export interface GeneratedResetToken {
  token: string;
  tokenHash: string;
  code: string;
  codeHash: string;
  expiresAt: Date;
}

export const generateResetToken = (): GeneratedResetToken => {
  const token = randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  return {
    token,
    tokenHash: hashToken(token),
    code,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
  };
};

/** Exchange token handed to mobile once the emailed code checks out. */
export const generateExchangeToken = () => {
  const token = randomBytes(RESET_TOKEN_BYTES).toString("hex");
  return { token, tokenHash: hashToken(token) };
};
