import { z } from "zod";

export const dateSchema = z.coerce.date();

export const optionalDateSchema = dateSchema.optional();
