import { Router } from 'express';
import { isAdmin } from '../../middlewares/role.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  getCouponsController,
  createCouponController,
  updateCouponController,
  deleteCouponController,
} from "../../controllers/admin/admin.coupons.controllers";

export const adminCouponsRouter: Router = Router();

adminCouponsRouter.use(authMiddleware, isAdmin);

adminCouponsRouter.get('/', getCouponsController);
adminCouponsRouter.post('/', createCouponController);
adminCouponsRouter.put('/:id', updateCouponController);
adminCouponsRouter.delete('/:id', deleteCouponController);