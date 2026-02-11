import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  createOrderController,
  getOrdersController,
  getOrderByIdController,
  getOrderInvoiceController,
} from '../controllers/orders.controllers';
import { orderRateLimiter } from '../middlewares/orderRateLimiter.middleware';

export const ordersRouter: Router = Router();

ordersRouter.use(authMiddleware);

ordersRouter.post('/', orderRateLimiter, createOrderController);
ordersRouter.get('/', orderRateLimiter, getOrdersController);
ordersRouter.get('/:id', orderRateLimiter, getOrderByIdController);
ordersRouter.get('/:id/invoice', orderRateLimiter, getOrderInvoiceController);