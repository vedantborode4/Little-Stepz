import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { categorySchema, idParam, namedEntitySchema, updateCategorySchema, updateNamedEntitySchema } from "@repo/crm-schema";
import { requirePermission } from "../../core/auth";
import { requestContext, sendData } from "../../core/http";
import * as catalog from "./catalog.service";

const includeInactiveQuery = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const SCHEMAS = {
  category: { create: categorySchema, update: updateCategorySchema },
  brand: { create: namedEntitySchema, update: updateNamedEntitySchema },
};

/** Same endpoints for categories and brands; a category also takes its GST rate. */
function namedRoutes(kind: catalog.NamedKind) {
  const router = Router();
  router.get("/", requirePermission("products.view"), async (req: Request, res: Response) => {
    const { includeInactive } = includeInactiveQuery.parse(req.query);
    sendData(res, await catalog.listNamed(kind, includeInactive));
  });
  router.post("/", requirePermission("products.manage"), async (req: Request, res: Response) => {
    sendData(res, await catalog.createNamed(kind, SCHEMAS[kind].create.parse(req.body), requestContext(req)), 201);
  });
  router.patch("/:id", requirePermission("products.manage"), async (req: Request, res: Response) => {
    const { id } = idParam.parse(req.params);
    sendData(res, await catalog.updateNamed(kind, id, SCHEMAS[kind].update.parse(req.body), requestContext(req)));
  });
  return router;
}

export const categoriesRoutes = namedRoutes("category");
export const brandsRoutes = namedRoutes("brand");
