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
import { preOrderRouter } from "./preorder.routes";
import { paymentRouter }  from "./payment.routes";
import { affiliateRouter }  from "./affiliate.routes";
import { handleReferralClickController } from "../controllers/affiliate.controllers";
import { referralClickRateLimiter } from "../middlewares/affiliateRateLimiter.middleware";
import { bannerRouter }  from "./banner.routes";
import { notificationRouter } from "./notification.routes";
import { phoneVerificationRouter } from "./phoneVerification.routes";


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

appRouter.use("/pre-orders", preOrderRouter)

appRouter.use("/payments",   paymentRouter);

// NOTE: no "/webhooks" mount here. `index.ts` mounts webhookRouter BEFORE the global
// express.json(), because Razorpay's signature is computed over the raw body. Mounting
// it again here put a second, JSON-parsed copy of the same paths behind the body
// parser — and any request that reached it would fail signature verification.

appRouter.use("/affiliate",  affiliateRouter);

appRouter.use("/banners",    bannerRouter);

appRouter.use("/notifications", notificationRouter);

appRouter.use("/phone", phoneVerificationRouter);


//  /ref/:referralCode
appRouter.get("/ref/:referralCode", referralClickRateLimiter, handleReferralClickController);