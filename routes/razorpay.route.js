import { Router } from "express";

const router = Router();

import {
  handleRazorpayWebhook,
  verifyPayment,
} from "../controllers/razorpay.controller.js";

router.post("/razorpay-webhook", handleRazorpayWebhook);
router.post("/verify", verifyPayment);

export default router;
