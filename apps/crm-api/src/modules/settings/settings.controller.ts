import type { Request, Response } from "express";
import { z } from "zod";
import {
  businessProfileSchema,
  createLocationSchema,
  createReceivingAccountSchema,
  idParam,
  updateLocationSchema,
  updateReceivingAccountSchema,
} from "@repo/crm-schema";
import { requestContext, sendData } from "../../core/http";
import * as settingsService from "./settings.service";

const includeInactiveQuery = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export async function getBusinessProfile(_req: Request, res: Response) {
  sendData(res, await settingsService.getBusinessProfile());
}

export async function saveBusinessProfile(req: Request, res: Response) {
  const input = businessProfileSchema.parse(req.body);
  sendData(res, await settingsService.saveBusinessProfile(input, requestContext(req)));
}

export async function listLocations(req: Request, res: Response) {
  const { includeInactive } = includeInactiveQuery.parse(req.query);
  sendData(res, await settingsService.listLocations(includeInactive));
}

export async function createLocation(req: Request, res: Response) {
  const input = createLocationSchema.parse(req.body);
  sendData(res, await settingsService.createLocation(input, requestContext(req)), 201);
}

export async function updateLocation(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = updateLocationSchema.parse(req.body);
  sendData(res, await settingsService.updateLocation(id, input, requestContext(req)));
}

export async function listReceivingAccounts(req: Request, res: Response) {
  const { includeInactive } = includeInactiveQuery.parse(req.query);
  sendData(res, await settingsService.listReceivingAccounts(includeInactive));
}

export async function createReceivingAccount(req: Request, res: Response) {
  const input = createReceivingAccountSchema.parse(req.body);
  sendData(res, await settingsService.createReceivingAccount(input, requestContext(req)), 201);
}

export async function updateReceivingAccount(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = updateReceivingAccountSchema.parse(req.body);
  sendData(res, await settingsService.updateReceivingAccount(id, input, requestContext(req)));
}
