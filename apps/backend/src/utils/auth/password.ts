import bcrypt from "bcrypt";

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);

if (!SALT_ROUNDS || Number.isNaN(SALT_ROUNDS)) {
  throw new Error("SALT_ROUNDS environment variable must be a valid number");
}

export const hashPassword = (password: string) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = (
  password: string,
  hashedPassword: string
) => {
  return bcrypt.compare(password, hashedPassword);
};
