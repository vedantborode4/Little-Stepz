import { Router } from "express";
import { authRouter } from "./auth.routes";
import { userRouter } from "./user.routes";
import { addressRouter } from "./address.routes";
import { categoryRouter } from "./category.routes";
import { adminRouter } from "./admin/admin.routes";
import { productRouter } from "./product.routes";
import { wishlistRouter } from "./wishlist.routes";
import { reviewRouter } from "./review.routes";
import { cartRouter } from "./cart.routes";

export const appRouter:Router = Router()

appRouter.use("/auth", authRouter)

appRouter.use("/users", userRouter)

appRouter.use("/address", addressRouter)

appRouter.use("/categories", categoryRouter)

appRouter.use("/admin", adminRouter)

appRouter.use("/products", productRouter)

appRouter.use("/wishlist", wishlistRouter)

appRouter.use("/reviews", reviewRouter)

appRouter.use("/cart", cartRouter)