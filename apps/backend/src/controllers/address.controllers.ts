import { Request, Response } from "express";
import { createAddressSchema, updateAddressSchema } from "@repo/zod-schema/index";
import {
  createAddressService,
  deleteAddressService,
  getAddressesService,
  setDefaultAddressService,
  updateAddressService,
} from "../services/address.services";
import { ApiError, ApiResponse, asyncHandler } from "../utils/api";

async function getAddresses(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const addresses = await getAddressesService(req.user.userId);

  return new ApiResponse(
    200,
    addresses,
    "Addresses fetched successfully"
  ).send(res);
}

async function createAddress(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const parsed = createAddressSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "Invalid address data",
      parsed.error.flatten().fieldErrors
    );
  }

  const address = await createAddressService(
    req.user.userId,
    parsed.data
  );

  return new ApiResponse(
    201,
    address,
    "Address created successfully"
  ).send(res);
}

async function updateAddress(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Address ID is required");
  }
  const parsed = updateAddressSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "Invalid address data",
      parsed.error.flatten().fieldErrors
    );
  }

  const address = await updateAddressService(
    req.user.userId,
    id,
    parsed.data
  );

  return new ApiResponse(
    200,
    address,
    "Address updated successfully"
  ).send(res);
}

async function deleteAddress(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Address ID is required");
  }
  
  await deleteAddressService(req.user.userId, id);

  return new ApiResponse(
    200,
    null,
    "Address deleted successfully"
  ).send(res);
}

async function setDefaultAddress(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Address ID is required");
  }
  const address = await setDefaultAddressService(
    req.user.userId,
    id
  );

  return new ApiResponse(
    200,
    address,
    "Default address updated successfully"
  ).send(res);
}

export const getAddressesController = asyncHandler(getAddresses);
export const createAddressController = asyncHandler(createAddress);
export const updateAddressController = asyncHandler(updateAddress);
export const deleteAddressController = asyncHandler(deleteAddress);
export const setDefaultAddressController = asyncHandler(setDefaultAddress);
