import { prisma } from "@repo/db/client";
import { AddressData, UpdateAddressData } from "@repo/zod-schema/index";
import { ApiError } from "../utils/api";
import { assertServiceable } from "../utils/shipping";
import { assertPhoneVerified } from "./phoneVerification.services";

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
  const addresses = await prisma.address.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: addressSelect,
  });

  if (!addresses.length) return [];

  // Prisma can't compute this in `addressSelect`, so it's one extra query rather
  // than an N+1. Surfaced so the UI can nudge without blocking: addresses that
  // predate phone verification stay usable.
  const verified = await prisma.verifiedPhone.findMany({
    where: { userId, phone: { in: addresses.map((a) => a.phone) } },
    select: { phone: true },
  });
  const verifiedSet = new Set(verified.map((v) => v.phone));

  return addresses.map((a) => ({ ...a, phoneVerified: verifiedSet.has(a.phone) }));
}

/**
 * Reject a pincode Delhivery cannot deliver to, at the point the customer types it.
 *
 * Serviceability was only ever checked at checkout, so a customer could save an
 * address, shop, and only discover at payment that we don't deliver there.
 * `assertServiceable` fails open on a Delhivery outage, so this can't make saving an
 * address depend on their API being up. Checked as ONLINE: COD availability is a
 * per-order concern and is still enforced at checkout.
 */
async function assertDeliverablePincode(pincode: string): Promise<void> {
  await assertServiceable(pincode, "ONLINE");
}

export async function createAddressService(
  userId: string,
  data: AddressData
) {
  await assertDeliverablePincode(data.pincode);
  // Same "validate before write, outside the transaction" shape as the pincode check.
  await assertPhoneVerified(userId, data.phone);

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
  // Outside the transaction: this is an external HTTP call and must not hold a
  // row-locked transaction open across Delhivery.
  if (data.pincode) await assertDeliverablePincode(data.pincode);

  // Verification is required ONLY when the phone actually changes.
  //
  // This is the detail that decides whether existing customers keep working: both
  // clients submit the whole address object on edit, so a naive "is `phone` present"
  // check would demand an OTP from a legacy customer fixing a typo in their city.
  if (data.phone) {
    const current = await prisma.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
      select: { phone: true },
    });
    if (current && data.phone !== current.phone) {
      await assertPhoneVerified(userId, data.phone);
    }
  }

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
