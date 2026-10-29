import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { prisma } from "@repo/crm-db/client";
import { env } from "./config/env";
import { errorHandler, notFoundHandler, requestId, requestLogger } from "./core/middleware";
import { apiRoutes } from "./routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY_HOPS);
  app.disable("x-powered-by");

  app.use(requestId);
  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true, exposedHeaders: ["Content-Disposition", "X-Request-Id"] }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  });

  app.use("/api/v1", apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
