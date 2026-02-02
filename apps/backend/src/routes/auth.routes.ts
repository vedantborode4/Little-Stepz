import { Router } from "express";
import { logoutController, refreshController, signinController, signupController } from "../controllers/auth.controllers";

export const authRouter: Router = Router();

authRouter.post("/signup", signupController);
authRouter.post("/signin", signinController);
authRouter.post("/logout", logoutController);

authRouter.post("/refresh", refreshController);
