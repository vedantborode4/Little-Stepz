import { OAuth2Client } from "google-auth-library";
import { InvalidTokenError } from "./errors";

// Accept ID tokens minted for any of our OAuth clients (web, iOS, Android, Expo).
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (GOOGLE_CLIENT_IDS.length === 0) {
  throw new Error("GOOGLE_CLIENT_IDS is not set");
}

const client = new OAuth2Client();

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export const verifyGoogleIdToken = async (
  idToken: string
): Promise<GoogleProfile> => {
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_IDS,
    });
    payload = ticket.getPayload();
  } catch {
    throw new InvalidTokenError("Invalid Google credential");
  }

  if (!payload?.sub || !payload.email) {
    throw new InvalidTokenError("Google credential missing required fields");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name ?? payload.email.split("@")[0]!,
    picture: payload.picture,
  };
};
