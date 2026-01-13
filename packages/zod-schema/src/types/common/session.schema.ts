import { z } from "zod";

export const sessionIdSchema = z.string().uuid();

export const optionalSessionIdSchema = sessionIdSchema.optional();
