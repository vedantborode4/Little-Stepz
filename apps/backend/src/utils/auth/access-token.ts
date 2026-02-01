import jwt, {
  JwtPayload as JwtJwtPayload,
  SignOptions,
  TokenExpiredError as JwtTokenExpiredError,
} from "jsonwebtoken";
import { AccessTokenPayload } from "./types";
import { InvalidTokenError, TokenExpiredError } from "./errors";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const ACCESS_TOKEN_EXPIRES =
  (process.env.ACCESS_TOKEN_EXPIRES as SignOptions["expiresIn"]) ?? "30m";

if (!ACCESS_TOKEN_SECRET) {
  throw new Error("ACCESS_TOKEN_SECRET is not set");
}

export const generateAccessToken = (
  payload: AccessTokenPayload
): string => {
  return jwt.sign(payload as JwtJwtPayload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
};

export const verifyAccessToken = (
  token: string
): AccessTokenPayload => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as AccessTokenPayload;
  } catch (err) {
    if (err instanceof JwtTokenExpiredError) {
      throw new TokenExpiredError();
    }

    throw new InvalidTokenError();
  }
};
