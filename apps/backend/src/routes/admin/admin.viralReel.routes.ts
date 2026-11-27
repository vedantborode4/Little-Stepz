import { Router } from "express";
import {
  adminListViralReelsController,
  adminCreateViralReelController,
  adminUpdateViralReelController,
  adminToggleViralReelController,
  adminDeleteViralReelController,
} from "../../controllers/admin/admin.viralReel.controllers";

export const adminViralReelRouter: Router = Router();

adminViralReelRouter.get("/", adminListViralReelsController);
adminViralReelRouter.post("/", adminCreateViralReelController);
adminViralReelRouter.put("/:id", adminUpdateViralReelController);
adminViralReelRouter.patch("/:id/toggle", adminToggleViralReelController);
adminViralReelRouter.delete("/:id", adminDeleteViralReelController);
