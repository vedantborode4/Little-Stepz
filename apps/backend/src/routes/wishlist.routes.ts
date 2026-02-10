import { Router } from "express";
import {
  getWishlistController,
  addToWishlistController,
  removeFromWishlistController,
} from "../controllers/wishlist.controllers";
import { authMiddleware } from "../middlewares/auth.middleware";

export const wishlistRouter: Router = Router();

wishlistRouter.use(authMiddleware);

wishlistRouter.get("/", getWishlistController);
wishlistRouter.post("/", addToWishlistController);
wishlistRouter.delete("/:productId", removeFromWishlistController);