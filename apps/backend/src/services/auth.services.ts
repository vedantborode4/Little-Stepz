import { prisma } from "@repo/db/client";
import { SigninData, SignupData } from "@repo/zod-schema/index";
import { comparePassword, hashPassword } from "../utils/auth/password";
import { generateAccessToken } from "../utils/auth/access-token";
import {
  generateRefreshToken,
} from "../utils/auth/refresh-token";
import { hashToken, timingSafeEqualHex } from "../utils/auth/tokenHash";
import {
  generateExchangeToken,
  generateResetToken,
  MAX_RESET_CODE_ATTEMPTS,
  PASSWORD_RESET_TTL_MINUTES,
} from "../utils/auth/reset-token";
import {
  InvalidTokenError,
  PasswordNotSetError,
  TokenReuseDetectedError,
} from "../utils/auth/errors";
import { verifyGoogleIdToken } from "../utils/auth/google";
import { verifyAppleIdentityToken } from "../utils/auth/apple";
import { ApiError } from "../utils/api/ApiError";
import { sendPasswordChangedEmail, sendPasswordResetEmail, sendSignupOtpEmail } from "../utils/email";
import {
  generateSignupOtp,
  MAX_SIGNUP_OTP_ATTEMPTS,
  MAX_SIGNUP_OTP_SENDS,
  SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
  SIGNUP_OTP_TTL_MINUTES,
} from "../utils/auth/signup-otp";
import { notify } from "./notification.services";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
};

/**
 * Resolve an affiliate referral code to the referring affiliate's *user* id.
 *
 * Referral codes live on `Affiliate.referralCode`, never on `User.referralCode` —
 * nothing in the codebase ever writes the latter to a real value, so the previous
 * `user.findUnique({ where: { referralCode } })` lookup could not match anything.
 * All three signup paths shared that bug: Google and Apple silently dropped the
 * attribution, while the password path *threw*, turning every deep-linked signup
 * into a 500.
 *
 * Unresolvable, unapproved and soft-deleted codes are all non-fatal: a bad referral
 * code must never stop someone creating an account.
 */
async function resolveReferrerUserId(
  code?: string | null
): Promise<string | undefined> {
  if (!code) return undefined;

  const affiliate = await prisma.affiliate.findUnique({
    // Codes are stored uppercase; the click-tracking paths normalise the same way.
    where: { referralCode: code.toUpperCase() },
    select: { userId: true, status: true, deletedAt: true },
  });

  if (!affiliate || affiliate.deletedAt || affiliate.status !== "APPROVED") {
    return undefined;
  }

  return affiliate.userId;
}

/**
 * Step 1 of signup — park the payload and email a code. **No User row is created.**
 *
 * That ordering is the whole point: an address that can't receive mail never reaches
 * the User table, so mistyped and throwaway addresses can't accumulate there.
 */
export async function requestSignupOtpService(
  data: SignupData,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<{ expiresInMinutes: number; resendAfterSeconds: number }> {
  const { email, password, name, phone, referralCode } = data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    throw new ApiError(409, "EMAIL_ALREADY_REGISTERED");
  }

  const existing = await prisma.pendingSignup.findUnique({ where: { email } });
  const now = new Date();

  if (existing) {
    const sinceLastSend = (now.getTime() - existing.lastSentAt.getTime()) / 1000;
    if (sinceLastSend < SIGNUP_OTP_RESEND_COOLDOWN_SECONDS) {
      throw new ApiError(429, "OTP_RESEND_TOO_SOON");
    }
    if (existing.sendCount >= MAX_SIGNUP_OTP_SENDS && existing.expiresAt > now) {
      throw new ApiError(429, "OTP_SEND_LIMIT");
    }
  }

  // Outside any transaction: bcrypt at cost 12 would blow an interactive-transaction
  // budget on Neon.
  const passwordHash = await hashPassword(password);
  const otp = generateSignupOtp();

  // Write before sending, so there is never an "email arrived but no row exists"
  // window. A repeat request supersedes the outstanding code rather than issuing a
  // second live one.
  await prisma.pendingSignup.upsert({
    where: { email },
    create: {
      email,
      name,
      phone,
      passwordHash,
      referralCode,
      codeHash: otp.codeHash,
      expiresAt: otp.expiresAt,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    },
    update: {
      name,
      phone,
      passwordHash,
      referralCode,
      codeHash: otp.codeHash,
      expiresAt: otp.expiresAt,
      // New secret, so the old guess count no longer applies. The abuse ceiling is
      // still MAX_SENDS × MAX_ATTEMPTS guesses out of 1,000,000.
      attempts: 0,
      sendCount: { increment: 1 },
      lastSentAt: now,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    },
  });

  // NOT fire-and-forget. `sendEmail` is fail-soft and returns false; for password
  // reset that's survivable because the account still exists, but here a silent
  // failure strands the user on a code screen for an account that can never be
  // created. So: await it, and on failure drop the row so the cooldown doesn't also
  // block the retry they're about to make.
  const sent = await sendSignupOtpEmail(email, {
    code: otp.code,
    expiresInMinutes: SIGNUP_OTP_TTL_MINUTES,
  });

  if (!sent) {
    if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
      // Local dev has no Resend key. Both conditions matter: a production instance
      // whose key was revoked must 502, never print codes to the log.
      console.warn(`[signup-otp] DEV ONLY — code for ${email}: ${otp.code}`);
    } else {
      await prisma.pendingSignup.deleteMany({ where: { email } });
      throw new ApiError(502, "EMAIL_SEND_FAILED");
    }
  }

  return {
    expiresInMinutes: SIGNUP_OTP_TTL_MINUTES,
    resendAfterSeconds: SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
  };
}

/** Step 2 — redeem the code and create the account. */
export async function verifySignupOtpService(email: string, code: string) {
  // One message for "no pending signup" and "wrong code" — otherwise this endpoint
  // reveals which signups are in flight.
  const invalid = () => new ApiError(400, "This code is invalid or has expired");

  const pending = await prisma.pendingSignup.findFirst({
    where: { email, expiresAt: { gte: new Date() } },
  });
  if (!pending) throw invalid();

  if (pending.attempts >= MAX_SIGNUP_OTP_ATTEMPTS) {
    throw new ApiError(400, "Too many incorrect attempts. Request a new code.");
  }

  if (!timingSafeEqualHex(pending.codeHash, hashToken(code))) {
    await prisma.pendingSignup.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
    throw invalid();
  }

  // Resolved fresh: the affiliate could have been removed during the OTP window.
  const referredById = await resolveReferrerUserId(pending.referralCode);
  const refresh = await generateRefreshToken();

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      // Claim the row atomically. Two concurrent verifies (double-tap, retry) would
      // otherwise both create an account; the second DELETE matches 0 rows.
      const claimed = await tx.pendingSignup.deleteMany({
        where: { id: pending.id, expiresAt: { gte: new Date() } },
      });
      if (claimed.count !== 1) throw invalid();

      const created = await tx.user.create({
        data: {
          email: pending.email,
          name: pending.name,
          phone: pending.phone,
          password: pending.passwordHash, // already hashed — never re-hash
          emailVerified: true,
          referredById,
        },
        select: userSelect,
      });

      await tx.refreshToken.create({
        data: {
          tokenHash: refresh.tokenHash,
          userId: created.id,
          expiresAt: refresh.expiresAt,
        },
      });

      return created;
    }, { maxWait: 5000, timeout: 15000 });
  } catch (err: any) {
    // The email was registered between request and verify (Google/Apple sign-in, or
    // an admin). The unique constraint is the real guard — a pre-check can't close
    // this race — and without mapping it the raw Prisma error becomes a 500.
    if (err?.code === "P2002") {
      throw new ApiError(409, "EMAIL_ALREADY_REGISTERED");
    }
    throw err;
  }

  if (referredById) {
    void notify({
      userId: referredById,
      type: "REFERRAL_SIGNUP",
      title: "New referral joined 🎉",
      body: `${pending.name} signed up using your referral link.`,
      data: { screen: "AffiliateDashboard" },
    });
  }

  const accessToken = generateAccessToken({ userId: user.id, role: user.role });

  return { user, accessToken, refreshToken: refresh.token };
}



export async function signinService(data: SigninData) {
  const { email, password } = data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // "Invalid email" vs "Invalid password" told anyone who asked whether an address
    // was registered. One message for both closes that without costing a real user
    // anything — the web sign-in page already matches on /invalid/i.
    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Deliberately NOT collapsed into the generic message: this account genuinely
    // cannot sign in with a password, and a generic error would strand the user with
    // no route forward. Enumeration hardening that breaks a legitimate login is a bad
    // trade. Which providers the account actually has decides the copy — an Apple-only
    // user was previously told to "continue with Google", which is a dead end.
    if (!user.password) {
      const providers: ("GOOGLE" | "APPLE")[] = [];
      if (user.googleId) providers.push("GOOGLE");
      if (user.appleId) providers.push("APPLE");
      throw new PasswordNotSetError(providers);
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });

    const refresh = await generateRefreshToken();
    
    await prisma.$transaction(async (tx) => {
      // 1-A: invalidate all previous refresh tokens
      await tx.refreshToken.deleteMany({
        where: { userId: user.id },
      });
      
      // create new refresh token
      await tx.refreshToken.create({
        data: {
          tokenHash: refresh.tokenHash,
          userId: user.id,
          expiresAt: refresh.expiresAt,
        },
      });
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken: refresh.token,
    };
}

export async function googleAuthService(idToken: string, referralCode?: string) {
  const profile = await verifyGoogleIdToken(idToken);

  if (!profile.emailVerified) {
    throw new Error("Google account email is not verified");
  }

  // 1. Existing Google user (fast path).
  let user = await prisma.user.findUnique({
    where: { googleId: profile.sub },
    select: userSelect,
  });

  // 2. Auto-link: a password account already owns this (verified) email.
  if (!user) {
    const existing = await prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true, googleId: true, avatarUrl: true },
    });

    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: existing.googleId ?? profile.sub,
          avatarUrl: existing.avatarUrl ?? profile.picture,
          emailVerified: true,
        },
        select: userSelect,
      });
    }
  }

  // 3. Brand-new account (no password — Google-only).
  if (!user) {
    const referredById = await resolveReferrerUserId(referralCode);

    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        googleId: profile.sub,
        avatarUrl: profile.picture,
        emailVerified: true,
        referredById,
      },
      select: userSelect,
    });

    if (referredById) {
      void notify({
        userId: referredById,
        type: "REFERRAL_SIGNUP",
        title: "New referral joined 🎉",
        body: `${profile.name} signed up using your referral link.`,
        data: { screen: "AffiliateDashboard" },
      });
    }
  }

  // Any pending email signup for this address can never complete now — the address
  // belongs to a real account. Dropping it turns a mystifying "invalid code" into a
  // clean "already registered".
  void prisma.pendingSignup.deleteMany({ where: { email: profile.email } });

  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
  });

  const refresh = await generateRefreshToken();

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: user!.id } });
    await tx.refreshToken.create({
      data: {
        tokenHash: refresh.tokenHash,
        userId: user!.id,
        expiresAt: refresh.expiresAt,
      },
    });
  });

  return {
    user,
    accessToken,
    refreshToken: refresh.token,
  };
}

export async function appleAuthService(
  identityToken: string,
  opts: { givenName?: string; familyName?: string; referralCode?: string } = {}
) {
  const profile = await verifyAppleIdentityToken(identityToken);

  // 1. Existing Apple user (fast path).
  let user = await prisma.user.findUnique({
    where: { appleId: profile.sub },
    select: userSelect,
  });

  // 2. Auto-link: an account already owns this (verified) email. Private-relay
  //    addresses are stable per user, so they link just as safely as real ones.
  if (!user && profile.email && profile.emailVerified) {
    const existing = await prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true, appleId: true },
    });

    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          appleId: existing.appleId ?? profile.sub,
          emailVerified: true,
        },
        select: userSelect,
      });
    }
  }

  // 3. Brand-new account (no password — Apple-only).
  if (!user) {
    if (!profile.email) {
      throw new InvalidTokenError(
        "Apple did not share an email for this account. Please sign in with your email and password instead."
      );
    }

    const referredById = await resolveReferrerUserId(opts.referralCode);

    // Apple only sends the name on the very first authorization, and the token
    // never carries it — so this is the one and only chance to record it.
    const name =
      [opts.givenName, opts.familyName].filter(Boolean).join(" ").trim() ||
      profile.email.split("@")[0]!;

    user = await prisma.user.create({
      data: {
        email: profile.email,
        name,
        appleId: profile.sub,
        emailVerified: profile.emailVerified,
        referredById,
      },
      select: userSelect,
    });

    if (referredById) {
      void notify({
        userId: referredById,
        type: "REFERRAL_SIGNUP",
        title: "New referral joined 🎉",
        body: `${name} signed up using your referral link.`,
        data: { screen: "AffiliateDashboard" },
      });
    }
  }

  // As with Google: a pending email signup for this address is now unusable.
  if (profile.email) {
    void prisma.pendingSignup.deleteMany({ where: { email: profile.email } });
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
  });

  const refresh = await generateRefreshToken();

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: user!.id } });
    await tx.refreshToken.create({
      data: {
        tokenHash: refresh.tokenHash,
        userId: user!.id,
        expiresAt: refresh.expiresAt,
      },
    });
  });

  return {
    user,
    accessToken,
    refreshToken: refresh.token,
  };
}

export async function logoutService(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!storedToken) {
    return;
  }

  if (storedToken.revoked) {
    return;
  }

  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });
    return;
  }

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: {
      revoked: true,
      lastUsedAt: new Date(),
    },
  });
}



export async function refreshService(oldRefreshToken: string) {
  if (!oldRefreshToken) {
    throw new Error("Refresh token is required");
  }

  const tokenHash = hashToken(oldRefreshToken);

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const result = await tx.refreshToken.updateMany({
      where: {
        tokenHash,
        revoked: false,
        expiresAt: { gte: now },
      },
      data: {
        revoked: true,
        lastUsedAt: now,
      },
    });

    if (result.count !== 1) {
      const storedToken = await tx.refreshToken.findUnique({
        where: { tokenHash },
        select: {
          userId: true,
          revoked: true,
          expiresAt: true,
        },
      });

      if (!storedToken) {
        throw new TokenReuseDetectedError("Invalid or unknown refresh token");
      }

      if (storedToken.revoked) {
        await tx.refreshToken.updateMany({
          where: { userId: storedToken.userId, revoked: false },
          data: { revoked: true },
        });
        throw new TokenReuseDetectedError("Refresh token was previously revoked or reused");
      }

      throw new Error("Refresh token has expired");
    }

    const claimedToken = await tx.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        userId: true,
      },
    });

    if (!claimedToken) {
      throw new Error("Internal error: claimed token not found");
    }

    const newRefresh = await generateRefreshToken();

    await tx.refreshToken.create({
      data: {
        tokenHash: newRefresh.tokenHash,
        userId: claimedToken.userId,
        expiresAt: newRefresh.expiresAt,
      },
    });

    const user = await tx.user.findUnique({
      where: { id: claimedToken.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const newAccessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefresh.token,
    };
  }, {
    maxWait: 5000,
    timeout: 10000,
  });
}


/**
 * Always resolves, whether or not the email belongs to an account — the caller
 * returns an identical response either way so the endpoint can't be used to
 * discover which emails are registered.
 */
export async function requestPasswordResetService(
  email: string,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true },
  });

  if (!user) return;

  const reset = generateResetToken();

  await prisma.$transaction(async (tx) => {
    // a fresh request supersedes any outstanding one
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });

    await tx.passwordResetToken.create({
      data: {
        tokenHash: reset.tokenHash,
        codeHash: reset.codeHash,
        userId: user.id,
        expiresAt: reset.expiresAt,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });
  });

  const base = process.env.FRONTEND_URL ?? "";
  void sendPasswordResetEmail(user.email, {
    code: reset.code,
    resetUrl: `${base}/reset-password?token=${reset.token}`,
    expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
  });
}

/**
 * Trades the emailed 6-digit code for a single-use token, so mobile finishes
 * through the same reset endpoint the web link uses. The stored token hash is
 * rotated here, which invalidates the emailed link once the code is redeemed.
 */
export async function verifyResetCodeService(email: string, code: string) {
  const invalid = () => new ApiError(400, "This code is invalid or has expired");

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true },
  });

  if (!user) throw invalid();

  const record = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) throw invalid();

  if (record.attempts >= MAX_RESET_CODE_ATTEMPTS) {
    throw new ApiError(400, "Too many incorrect attempts. Request a new code.");
  }

  if (!timingSafeEqualHex(record.codeHash, hashToken(code))) {
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw invalid();
  }

  const exchange = generateExchangeToken();

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { tokenHash: exchange.tokenHash, attempts: 0 },
  });

  return { token: exchange.token };
}

export async function resetPasswordService(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const now = new Date();

  // single-use claim: only one caller can flip usedAt
  const claim = await prisma.passwordResetToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gte: now } },
    data: { usedAt: now },
  });

  if (claim.count !== 1) {
    throw new ApiError(400, "This reset link is invalid or has expired");
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { userId: true, user: { select: { email: true } } },
  });

  if (!record) {
    throw new ApiError(400, "This reset link is invalid or has expired");
  }

  const hashed = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { password: hashed },
    });

    // signing out every device kills any session an attacker may hold
    await tx.refreshToken.deleteMany({ where: { userId: record.userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } });
  });

  void sendPasswordChangedEmail(record.user.email);
}