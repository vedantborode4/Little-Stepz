import { z } from "zod";

export const authHeaderSchema = z.object({
  authorization: z
    .string()
    .regex(/^Bearer\s.+$/, "Invalid authorization header"),
});

export const optionalAuthHeaderSchema = z.object({
  authorization: z.string().optional(),
});
