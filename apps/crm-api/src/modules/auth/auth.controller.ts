import type { CookieOptions, Request, Response } from "express";
import { changePasswordSchema, loginSchema } from "@repo/crm-schema";
import { env } from "../../config/env";
import { currentUser } from "../../core/auth";
import { requestContext, sendData } from "../../core/http";
import * as authService from "./auth.service";

const REFRESH_COOKIE = "crm_rt";

const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "strict",
  path: "/api/v1/auth",
};

function respondWithSession(res: Response, session: authService.Session) {
  if (session.refreshToken) {
    res.cookie(REFRESH_COOKIE, session.refreshToken.token, { ...cookieBase, expires: session.refreshToken.expiresAt });
  }
  return sendData(res, { user: session.user, accessToken: session.accessToken });
}

const presentedRefreshToken = (req: Request): string | undefined => req.cookies?.[REFRESH_COOKIE];

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  respondWithSession(res, await authService.login(input, requestContext(req)));
}

export async function refresh(req: Request, res: Response) {
  try {
    respondWithSession(res, await authService.refresh(presentedRefreshToken(req), requestContext(req)));
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, cookieBase);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(presentedRefreshToken(req), requestContext(req));
  res.clearCookie(REFRESH_COOKIE, cookieBase);
  sendData(res, { ok: true });
}

export async function me(req: Request, res: Response) {
  sendData(res, { user: await authService.getSessionUser(currentUser(req).id) });
}

export async function changePassword(req: Request, res: Response) {
  const input = changePasswordSchema.parse(req.body);
  const user = await authService.changePassword(currentUser(req).id, input, presentedRefreshToken(req), requestContext(req));
  sendData(res, { user });
}
