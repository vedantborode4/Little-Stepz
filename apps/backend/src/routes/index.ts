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
import { couponsRouter } from "./coupons.routes";
import { checkoutRouter } from "./checkout.routes";
import { ordersRouter } from "./orders.routes";
import { paymentRouter }  from "./payment.routes";
import { webhookRouter }  from "./webhook.routes";
import { affiliateRouter }  from "./affiliate.routes";
import { handleReferralClickController } from "../controllers/affiliate.controllers";
import { referralClickRateLimiter } from "../middlewares/affiliateRateLimiter.middleware";
import { bannerRouter }  from "./banner.routes";


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

appRouter.use("/coupons", couponsRouter)

appRouter.use("/checkout", checkoutRouter)

appRouter.use("/orders", ordersRouter)

appRouter.use("/payments",   paymentRouter);

appRouter.use("/webhooks",   webhookRouter);

appRouter.use("/affiliate",  affiliateRouter);

appRouter.use("/banners",    bannerRouter);


//  /ref/:referralCode
appRouter.get("/ref/:referralCode", referralClickRateLimiter, handleReferralClickController);