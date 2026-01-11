import { Router } from "express";
import { signinController, signupController } from "../controllers/auth.controllers";

export const authRouter: Router= Router()

authRouter.post("/signup", signupController)

authRouter.post("/signin", signinController)