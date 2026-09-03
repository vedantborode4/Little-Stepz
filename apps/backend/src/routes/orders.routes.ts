import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  createOrderController,
  getOrdersController,
  getOrderByIdController,
  getOrderInvoiceController,
  getOrderReceiptController,
  cancelOrderController,
  abandonOrderController,
} from '../controllers/orders.controllers';
import { orderRateLimiter } from '../middlewares/orderRateLimiter.middleware';
import {
  requestReturnController,
  trackOrderController,
} from '../controllers/payment.controllers';

export const ordersRouter: Router = Router();

ordersRouter.use(authMiddleware);

ordersRouter.post('/', orderRateLimiter, createOrderController);
ordersRouter.get('/', orderRateLimiter, getOrdersController);
ordersRouter.get('/:id', orderRateLimiter, getOrderByIdController);
ordersRouter.get('/:id/invoice', orderRateLimiter, getOrderInvoiceController);
// The deposit acknowledgement on a partial-payment order. Available from the moment the
// deposit is captured, unlike the tax invoice, which is only raised at dispatch.
ordersRouter.get('/:id/receipt', orderRateLimiter, getOrderReceiptController);

ordersRouter.post('/:id/return', requestReturnController);
ordersRouter.get('/:id/track',   trackOrderController);
ordersRouter.post('/:id/cancel', orderRateLimiter, cancelOrderController);
ordersRouter.post('/:id/abandon', orderRateLimiter, abandonOrderController);
