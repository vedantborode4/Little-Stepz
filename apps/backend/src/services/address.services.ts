import { prisma } from "@repo/db/client";
import { AddressData, UpdateAddressData } from "@repo/zod-schema/index";
import { ApiError } from "../utils/api";

const addressSelect = {
  id: true,
  name: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  pincode: true,
  country: true,
  isDefault: true,
  createdAt: true,
};

export async function getAddressesService(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: addressSelect,
  });
}

export async function createAddressService(
  userId: string,
  data: AddressData
) {
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return tx.address.create({
      data: {
        ...data,
        userId,
      },
      select: addressSelect,
    });
  });
}

export async function updateAddressService(
  userId: string,
  addressId: string,
  data: UpdateAddressData
) {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });

  if (!address) {
    throw new ApiError(404, "Address not found");
  }

  return prisma.$transaction(async (tx) => {
    if (data.isDefault === true) {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return tx.address.update({
      where: { id: addressId },
      data,
      select: addressSelect,
    });
  });
}

export async function deleteAddressService(
  userId: string,
  addressId: string
) {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });

  if (!address) {
    throw new ApiError(404, "Address not found");
  }

  await prisma.address.delete({
    where: { id: addressId },
  });
}

export async function setDefaultAddressService(
  userId: string,
  addressId: string
) {
  return prisma.$transaction(async (tx) => {
    const address = await tx.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new ApiError(404, "Address not found");
    }

    await tx.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    return tx.address.update({
      where: { id: addressId },
      data: { isDefault: true },
      select: addressSelect,
    });
  });
}
