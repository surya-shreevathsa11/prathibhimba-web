import { Router } from "express";

const router = Router();

import {
  handleRazorpayWebhook,
  verifyPayment,
} from "../controllers/razorpay.controller.js";
import {
  handleRazorpayWebhook as handleRazorpayEventWebhook,
  verifyPayment as verifyEventPayment,
} from "../controllers/razorpayEvent.controller.js";

router.post("/razorpay-webhook", handleRazorpayWebhook);
router.post("/verify", verifyPayment);

// Events (event bookings)
router.post("/razorpay-event-webhook", handleRazorpayEventWebhook);
router.post("/verify-event", verifyEventPayment);

export default router;
