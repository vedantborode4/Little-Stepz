import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  getMeController,
  updateMeController,
  updatePasswordController,
} from "../controllers/user.controllers";

export const userRouter:Router = Router();

userRouter.get("/me", authMiddleware, getMeController);
userRouter.put("/me", authMiddleware, updateMeController);
userRouter.put("/me/password", authMiddleware, updatePasswordController);
