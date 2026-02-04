import { Router } from "express";
import { authRouter } from "./auth.routes";
import { userRouter } from "./user.routes";
import { addressRouter } from "./address.routes";
import { categoryRouter } from "./category.routes";

export const appRouter:Router = Router()

appRouter.use("/auth", authRouter)

appRouter.use("/users", userRouter)

appRouter.use("/address", addressRouter)

appRouter.use("/categories", categoryRouter)