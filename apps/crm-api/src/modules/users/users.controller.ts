import type { Request, Response } from "express";
import { createUserSchema, idParam, listQuery, resetPasswordSchema, ROLE_LABELS, updateUserSchema } from "@repo/crm-schema";
import { sendExport } from "../../core/export";
import { requestContext, sendData } from "../../core/http";
import * as usersService from "./users.service";

export async function list(req: Request, res: Response) {
  const query = listQuery.parse(req.query);
  const result = await usersService.listUsers(query);

  if (query.format) {
    return sendExport(res, {
      filename: "users",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Name", value: (u) => u.name, width: 24 },
        { header: "Email", value: (u) => u.email, width: 30 },
        { header: "Role", value: (u) => ROLE_LABELS[u.role] },
        { header: "Active", value: (u) => (u.isActive ? "Yes" : "No") },
        { header: "Last sign-in (UTC)", value: (u) => u.lastLoginAt, width: 24 },
      ],
    });
  }
  sendData(res, result);
}

export async function create(req: Request, res: Response) {
  const input = createUserSchema.parse(req.body);
  sendData(res, await usersService.createUser(input, requestContext(req)), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = updateUserSchema.parse(req.body);
  sendData(res, await usersService.updateUser(id, input, requestContext(req)));
}

export async function resetPassword(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = resetPasswordSchema.parse(req.body);
  sendData(res, await usersService.resetPassword(id, input, requestContext(req)));
}
