import { Router } from "express";
import { signupController } from "../controllers/auth.controllers";

export const authRouter: Router = Router();

authRouter.post("/signup", signupController);
