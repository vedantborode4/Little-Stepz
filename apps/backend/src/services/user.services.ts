import { prisma } from "@repo/db/client";
import { UpdatePasswordData, UpdateProfileData } from "@repo/zod-schema/index";
import { comparePassword, hashPassword } from "../utils/auth/password";
import { ApiError } from "../utils/api";

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  createdAt: true,
};

export async function getMeService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
}

export async function updateMeService(userId: string, data: UpdateProfileData) {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: userSelect,
    });
  } catch (err) {
    throw new ApiError(500, "Failed to update profile");
  }
}

export async function updatePasswordService(userId: string, data: UpdatePasswordData) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isValid = await comparePassword(data.oldPassword, user.password);
  if (!isValid) {
    throw new ApiError(400, "Old password is incorrect");
  }

  const newHashed = await hashPassword(data.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { password: newHashed },
  });
}
