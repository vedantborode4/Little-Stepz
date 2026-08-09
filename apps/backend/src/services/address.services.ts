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
    where: { userId, deletedAt: null },
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
        where: { userId, deletedAt: null },
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

/**
 * Editing an address must not rewrite history.
 *
 * `Order` and `PreOrder` hold an `addressId` FK, not a snapshot, so an in-place
 * update silently changed the delivery address on every past order — including ones
 * Delhivery had already delivered somewhere else. Invoices and disputes then
 * disagreed with what actually happened.
 *
 * So: if any order or pre-order references this address, the old row is retired
 * (soft-deleted, keeping it readable by those orders) and a new row carries the
 * edit. Addresses nothing points at are still updated in place, which keeps the id
 * stable for the common case of fixing a typo before ordering.
 */
export async function updateAddressService(
  userId: string,
  addressId: string,
  data: UpdateAddressData
) {
  return prisma.$transaction(async (tx) => {
    const address = await tx.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
    });

    if (!address) {
      throw new ApiError(404, "Address not found");
    }

    if (data.isDefault === true) {
      await tx.address.updateMany({
        where: { userId, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const [orderRefs, preOrderRefs] = await Promise.all([
      tx.order.count({ where: { addressId } }),
      tx.preOrder.count({ where: { addressId } }),
    ]);

    if (orderRefs + preOrderRefs === 0) {
      return tx.address.update({
        where: { id: addressId },
        data,
        select: addressSelect,
      });
    }

    await tx.address.update({
      where: { id: addressId },
      data: { deletedAt: new Date(), isDefault: false },
    });

    const { isDefault, ...rest } = data;
    return tx.address.create({
      data: {
        userId,
        name:      rest.name      ?? address.name,
        phone:     rest.phone     ?? address.phone,
        address:   rest.address   ?? address.address,
        city:      rest.city      ?? address.city,
        state:     rest.state     ?? address.state,
        pincode:   rest.pincode   ?? address.pincode,
        country:   rest.country   ?? address.country,
        isDefault: isDefault ?? address.isDefault,
      },
      select: addressSelect,
    });
  });
}

/**
 * Soft delete. A hard `delete` threw a foreign-key violation (P2003) for any
 * address an order had ever shipped to — `Order.addressId` is required — so
 * customers simply could not remove their most-used addresses. The `deletedAt`
 * column already existed and every order-side lookup already filtered on it.
 */
export async function deleteAddressService(
  userId: string,
  addressId: string
) {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId, deletedAt: null },
  });

  if (!address) {
    throw new ApiError(404, "Address not found");
  }

  await prisma.address.update({
    where: { id: addressId },
    data: { deletedAt: new Date(), isDefault: false },
  });
}

export async function setDefaultAddressService(
  userId: string,
  addressId: string
) {
  return prisma.$transaction(async (tx) => {
    const address = await tx.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
    });

    if (!address) {
      throw new ApiError(404, "Address not found");
    }

    await tx.address.updateMany({
      where: { userId, deletedAt: null },
      data: { isDefault: false },
    });

    return tx.address.update({
      where: { id: addressId },
      data: { isDefault: true },
      select: addressSelect,
    });
  });
}
