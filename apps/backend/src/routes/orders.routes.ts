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
import { documentRateLimiter } from '../middlewares/documentRateLimiter.middleware';
import {
  requestReturnController,
  trackOrderController,
} from '../controllers/payment.controllers';
import {
  getOrderReturnsController,
  quoteReturnController,
  returnUploadSignatureController,
  createReturnController,
  cancelReturnController,
} from '../controllers/returns.controllers';
import { returnRateLimiter } from '../middlewares/returnRateLimiter.middleware';

export const ordersRouter: Router = Router();

ordersRouter.use(authMiddleware);

ordersRouter.post('/', orderRateLimiter, createOrderController);
ordersRouter.get('/', orderRateLimiter, getOrdersController);
ordersRouter.get('/:id', orderRateLimiter, getOrderByIdController);
ordersRouter.get('/:id/invoice', documentRateLimiter, getOrderInvoiceController);
// The deposit acknowledgement on a partial-payment order. Available from the moment the
// deposit is captured, unlike the tax invoice, which is only raised at dispatch.
ordersRouter.get('/:id/receipt', documentRateLimiter, getOrderReceiptController);

ordersRouter.post('/:id/return', requestReturnController);
// Item-level returns. `/:id/return` above is the legacy whole-order endpoint that
// published app binaries still call.
ordersRouter.get('/:id/returns', returnRateLimiter, getOrderReturnsController);
ordersRouter.post('/:id/returns/quote', returnRateLimiter, quoteReturnController);
ordersRouter.post('/:id/returns/upload-signature', returnRateLimiter, returnUploadSignatureController);
ordersRouter.post('/:id/returns', returnRateLimiter, createReturnController);
ordersRouter.post('/:id/returns/:returnId/cancel', returnRateLimiter, cancelReturnController);
ordersRouter.get('/:id/track',   trackOrderController);
ordersRouter.post('/:id/cancel', orderRateLimiter, cancelOrderController);
ordersRouter.post('/:id/abandon', orderRateLimiter, abandonOrderController);
