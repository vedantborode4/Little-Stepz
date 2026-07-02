import { z } from "zod";
import { optionalPriceSchema, stockSchema, uuidSchema } from "./common";

const MAX_COMBINATIONS = 200;

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Use a hex colour like #FF0000")
  .nullish();

export const optionValueInputSchema = z.object({
  value: z.string().trim().min(1, "Value is required").max(80, "Value is too long"),
  swatchHex: hexColor,
});

export const optionInputSchema = z.object({
  name: z.string().trim().min(1, "Option name is required").max(60, "Option name is too long"),
  values: z.array(optionValueInputSchema).min(1, "Add at least one value").max(50, "Too many values"),
});

export const matrixGenerateSchema = z
  .object({
    options: z.array(optionInputSchema).min(1, "Add at least one option").max(5, "Too many options"),
    defaults: z
      .object({
        price: optionalPriceSchema,
        salePrice: optionalPriceSchema,
        isOnSale: z.boolean().optional().default(false),
        stock: stockSchema.optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const total = data.options.reduce((acc, o) => acc * o.values.length, 1);
    if (total > MAX_COMBINATIONS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: `That would generate ${total} variants (max ${MAX_COMBINATIONS}). Reduce the options or values.`,
      });
    }
  });

export const optionParamsSchema = z.object({ optionId: uuidSchema });
export const optionValueParamsSchema = z.object({ valueId: uuidSchema });

export type MatrixGenerateData = z.infer<typeof matrixGenerateSchema>;
export type OptionInput = z.infer<typeof optionInputSchema>;
