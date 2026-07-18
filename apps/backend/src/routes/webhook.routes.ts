import { Router } from "express";
import express from "express";
import { razorpayWebhookController, delhiveryWebhookController } from "../controllers/payment.controllers";

export const webhookRouter: Router = Router();

webhookRouter.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  razorpayWebhookController
);

// This router is mounted before the global JSON parser, so parse the body locally.
// Delhivery does not sign webhooks — auth is a shared-secret token in the controller.
webhookRouter.post(
  "/delhivery",
  express.json({ type: "*/*" }),
  delhiveryWebhookController
);
