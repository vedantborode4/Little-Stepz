import { Router } from "express";
import { getViralReelsController } from "../controllers/viralReel.controllers";

export const viralReelRouter: Router = Router();

viralReelRouter.get("/", getViralReelsController);
