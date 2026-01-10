import z from "zod";

export const SignupSchema = z.object({
  email: z
    .string()
    .email({ message: "Please enter a valid email." })
    .trim(),
  name: z
    .string()
    .min(2, { message: "Name must be at least 2 characters long." })
    .trim(),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters long." })
    .regex(/[a-zA-Z]/, { message: "Must contain at least one letter." })
    .regex(/[0-9]/, { message: "Must contain at least one number." })
    .regex(/[^a-zA-Z0-9]/, {
      message: "Must contain at least one special character.",
    })
    .trim(),
});

export const SigninSchema = z.object({
  email: z
    .string()
    .email({ message: "Please enter a valid email." })
    .trim(),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters long." })
    .regex(/[a-zA-Z]/, { message: "Must contain at least one letter." })
    .regex(/[0-9]/, { message: "Must contain at least one number." })
    .regex(/[^a-zA-Z0-9]/, {
      message: "Must contain at least one special character.",
    })
    .trim(),
});
