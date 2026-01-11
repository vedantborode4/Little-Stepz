import { Router } from "express";
import { authRouter } from "./auth.routes";

export const appRouter:Router = Router()

appRouter.use("/auth", authRouter)