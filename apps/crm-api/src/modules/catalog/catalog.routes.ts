import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, namedEntitySchema, updateNamedEntitySchema } from "@repo/crm-schema";
import { requirePermission } from "../../core/auth";
import { requestContext, sendData } from "../../core/http";
import * as catalog from "./catalog.service";

const includeInactiveQuery = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

/** Same four endpoints for categories and brands. */
function namedRoutes(kind: catalog.NamedKind) {
  const router = Router();
  router.get("/", requirePermission("products.view"), async (req: Request, res: Response) => {
    const { includeInactive } = includeInactiveQuery.parse(req.query);
    sendData(res, await catalog.listNamed(kind, includeInactive));
  });
  router.post("/", requirePermission("products.manage"), async (req: Request, res: Response) => {
    sendData(res, await catalog.createNamed(kind, namedEntitySchema.parse(req.body), requestContext(req)), 201);
  });
  router.patch("/:id", requirePermission("products.manage"), async (req: Request, res: Response) => {
    const { id } = idParam.parse(req.params);
    sendData(res, await catalog.updateNamed(kind, id, updateNamedEntitySchema.parse(req.body), requestContext(req)));
  });
  return router;
}

export const categoriesRoutes = namedRoutes("category");
export const brandsRoutes = namedRoutes("brand");
