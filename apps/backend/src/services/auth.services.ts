import { prisma } from "@repo/db/client";
import { SigninData, SignupData } from "@repo/zod-schema/index";
import { comparePassword, hashPassword } from "../utils/auth/password";
import { generateAccessToken } from "../utils/auth/access-token";
import {
  generateRefreshToken,
} from "../utils/auth/refresh-token";
import { hashToken } from "../utils/auth/tokenHash";
import { TokenReuseDetectedError } from "../utils/auth/errors";

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