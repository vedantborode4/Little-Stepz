import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { cartMiddleware } from "../middlewares/cart.middleware";
import {
  getCartController,
  addCartItemController,
  updateCartItemController,
  removeCartItemController,
  clearCartController,
  syncCartController,
} from "../controllers/cart.controllers";

export const cartRouter: Router = Router();

cartRouter.use(cartMiddleware);

cartRouter.get("/", getCartController);
cartRouter.post("/add", addCartItemController);
cartRouter.put("/update", updateCartItemController);
cartRouter.delete("/remove", removeCartItemController);
cartRouter.delete("/clear", clearCartController);
cartRouter.post("/sync", authMiddleware, syncCartController);