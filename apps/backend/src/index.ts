import express from "express"
import "dotenv/config"
import { appRouter } from "./routes";
import cookieParser from "cookie-parser"
import { errorHandler } from "./middlewares/errorHandler.middleware";
import cors from "cors";
import { webhookRouter } from "./routes/webhook.routes";

const app = express();
// Allow-list of dev origins (the `||` chain only ever returned the first value).
// Includes the Expo web ports so the mobile app's web build can call the API.
const ORIGIN = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:8081",
  "http://localhost:8082",
];

app.use("/api/v1/webhooks", webhookRouter);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(cors({
    origin: ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    // The mobile client identifies itself and carries its guest cart session in
    // headers; the cart session is echoed back so it can be persisted client-side.
    // (Native requests bypass CORS entirely — this is for the Expo web build.)
    allowedHeaders: ["Content-Type", "Authorization", "X-Client-Platform", "X-Cart-Session"],
    exposedHeaders: ["X-Cart-Session"],
}))

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.removeHeader("X-Powered-By");
  next();
});

app.use("/api/v1", appRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || "development"}`);
});