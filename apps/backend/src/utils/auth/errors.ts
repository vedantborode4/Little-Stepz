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
