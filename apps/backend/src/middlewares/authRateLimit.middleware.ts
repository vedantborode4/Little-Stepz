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
