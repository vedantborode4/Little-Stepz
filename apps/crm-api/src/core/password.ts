import bcrypt from "bcrypt";
import { env } from "../config/env";

export const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_ROUNDS);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/** Compared against when the email is unknown, so response time doesn't reveal which emails exist. */
export const TIMING_DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-password", 10);
