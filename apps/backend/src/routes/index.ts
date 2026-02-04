import { Router } from "express";
import { authRouter } from "./auth.routes";
import { userRouter } from "./user.routes";

export const appRouter:Router = Router()

appRouter.use("/auth", authRouter)

appRouter.use("/users", userRouter);