export abstract class AuthError extends Error {
  abstract statusCode: number;
  abstract code: string;

  protected constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidTokenError extends AuthError {
  statusCode = 401;
  code = "INVALID_TOKEN";

  constructor(message = "Invalid token") {
    super(message);
  }
}

export class TokenExpiredError extends AuthError {
  statusCode = 401;
  code = "TOKEN_EXPIRED";

  constructor(message = "Token expired") {
    super(message);
  }
}

export class TokenRevokedError extends AuthError {
  statusCode = 401;
  code = "TOKEN_REVOKED";

  constructor(message = "Token has been revoked") {
    super(message);
  }
}

export class TokenReuseDetectedError extends AuthError {
  statusCode = 403;
  code = "TOKEN_REUSE_DETECTED";

  constructor(message = "Refresh token reuse detected") {
    super(message);
  }
}

/**
 * The account exists but has no password — it was created through Google or Apple
 * sign-in, which never sets one. Deliberately NOT collapsed into the generic
 * "invalid email or password": that would strand a real user with no way forward.
 * `providers` lets the clients name the right button instead of always saying
 * "Google", and the code lets them offer the set-a-password route.
 */
export class PasswordNotSetError extends AuthError {
  statusCode = 401;
  code = "PASSWORD_NOT_SET";

  constructor(readonly providers: ("GOOGLE" | "APPLE")[]) {
    super(PasswordNotSetError.describe(providers));
  }

  private static describe(providers: ("GOOGLE" | "APPLE")[]): string {
    const names = providers.map((p) => (p === "GOOGLE" ? "Google" : "Apple"));
    if (names.length === 0) {
      return "This account has no password yet. Use “Forgot password?” to set one.";
    }
    return `This account uses ${names.join(" or ")} sign-in. Continue with ${names.join(
      " or "
    )}, or use “Forgot password?” to set a password.`;
  }
}
