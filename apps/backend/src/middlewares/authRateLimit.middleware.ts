import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many authentication attempts. Try again later."
    });
  },
});

// Sending the email is the abusable part, so requests are capped tightly.
// skipSuccessfulRequests must stay false: this endpoint answers 200 even for
// unknown emails, so a success-skipping limiter would never engage.
export const passwordResetRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many password reset requests. Try again later."
    });
  },
});

// Sending the signup code is the abusable part — it costs an email per request and
// is reachable without an account. skipSuccessfulRequests must stay FALSE: unlike
// `authRateLimiter` above, this endpoint answers 200 on the very request that does
// the work, so a success-skipping limiter would never engage at all.
//
// Deliberately a NEW rateLimit() rather than reusing passwordResetRequestRateLimiter:
// each call builds its own store, so sharing the object would mean a user who just
// reset their password couldn't sign up.
export const signupOtpRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many signup attempts. Try again later."
    });
  },
});

// Loose enough that the per-row attempt cap (5) is what actually stops a brute force.
export const signupOtpVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many attempts. Try again later."
    });
  },
});

// Redeeming a code/link needs more headroom — the per-token attempt cap is the
// real brute-force guard, and a limit that low would fire before it could.
export const passwordResetVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many attempts. Try again later."
    });
  },
});
