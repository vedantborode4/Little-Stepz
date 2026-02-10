import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware'; // Optional if guest allowed
import { cartMiddleware } from '../middlewares/cart.middleware';
import { couponValidateRateLimiter } from '../middlewares/couponRateLimiter.middleware';
import { validateCouponController } from '../controllers/coupons.controllers';

export const couponsRouter: Router = Router();

couponsRouter.post('/validate', cartMiddleware, couponValidateRateLimiter, validateCouponController);