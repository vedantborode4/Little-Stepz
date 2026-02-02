import { prisma } from "@repo/db/client";
import { SigninData, SignupData } from "@repo/zod-schema/index";
import { comparePassword, hashPassword } from "../utils/auth/password";
import { generateAccessToken } from "../utils/auth/access-token";
import {
  generateRefreshToken
} from "../utils/auth/refresh-token";

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
