import { z } from "zod";
import { uuidSchema } from "./common";

export const addWishlistItemBodySchema = z.object({ 
    productId: uuidSchema
});

export const removeWishlistItemParamsSchema = z.object({ 
    productId: uuidSchema 
});

export type AddWishlistItemBody = z.infer<typeof addWishlistItemBodySchema>;
export type RemoveWishlistItemParams = z.infer<typeof removeWishlistItemParamsSchema>;