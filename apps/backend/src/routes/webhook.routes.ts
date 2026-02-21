import { Router } from "express";
import express from "express";
import { razorpayWebhookController } from "../controllers/payment.controllers";

export const webhookRouter: Router = Router();

webhookRouter.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  razorpayWebhookController
);
