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
import { InvalidTokenError, TokenReuseDetectedError } from "../utils/auth/errors";
import { verifyGoogleIdToken } from "../utils/auth/google";
import { verifyAppleIdentityToken } from "../utils/auth/apple";
import { ApiError } from "../utils/api/ApiError";
import { sendPasswordChangedEmail, sendPasswordResetEmail } from "../utils/email";
import { notify } from "./notification.services";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
};



export async function signupService(data: SignupData) {
  const { email, password, name, phone, referralCode } = data;


  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("User already exists");
  }


  let referredById: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });

    if (!referrer) {
      throw new Error("Invalid referral code");
    }

    referredById = referrer.id;
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      phone,
      password: hashedPassword,
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

  // Tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
  });

  const refresh = await generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: refresh.tokenHash,
      userId: user.id,
      expiresAt: refresh.expiresAt,
    },
  });

  return {
    user,
    accessToken,
    refreshToken: refresh.token,
  };
}



export async function signinService(data: SigninData) {
  const { email, password } = data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("Invalid email");
    }

    if (!user.password) {
      throw new Error("This account uses Google sign-in. Continue with Google.");
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid password");
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
    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true },
      });
      if (referrer) referredById = referrer.id;
    }

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

    let referredById: string | undefined;
    if (opts.referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: opts.referralCode },
        select: { id: true },
      });
      if (referrer) referredById = referrer.id;
    }

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