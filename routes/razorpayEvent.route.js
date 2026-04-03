import { Router } from "express";

const router = Router();

import {
  verifyPayment,
  handleRazorpayWebhook,
} from "../controllers/razorpayEvent.controller.js";

router.post("/razorpay-webhook", handleRazorpayWebhook);
router.post("/verify", verifyPayment);

export default router;
