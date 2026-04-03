import crypto from "crypto";
import { Event } from "../models/events.model.js";
import { EventBooking } from "../models/eventBooking.model.js";

import {
  sendConfirmationMailToAdmin,
  sendConfirmationMailToGuest,
  sendPaymentFailedMailToGuest,
} from "../utils/eventResend.util.js";
/*
 * Razorpay sends webhooks for:
 * - payment.captured → Payment successful
 * - payment.failed → Payment failed
 * - order.paid → Order fully paid
 */

export const handleRazorpayWebhook = async (req, res) => {
  try {
    // Step 1: Verify webhook signature
    const webhookSignature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; // Set this in .env

    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Body type:", typeof req.body, Buffer.isBuffer(req.body));
    console.log("Signature header:", req.headers["x-razorpay-signature"]);
    console.log(
      "Webhook secret exists:",
      !!process.env.RAZORPAY_WEBHOOK_SECRET
    );

    if (!webhookSignature || !webhookSecret) {
      console.error("Missing webhook signature or secret");
      return res.status(400).json({ message: "Invalid webhook" });
    }

    // Create expected signature
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    // Compare signatures
    if (webhookSignature !== expectedSignature) {
      console.error("Webhook signature verification failed");
      return res.status(400).json({ message: "Invalid signature" });
    }

    // Step 2: Process webhook event
    const event = req.body.event;
    const payload = req.body.payload;

    switch (event) {
      case "payment.captured":
        await handlePaymentCaptured(payload);
        break;

      case "payment.failed":
        await handlePaymentFailed(payload);
        break;

      case "order.paid":
        await handleOrderPaid(payload);
        break;

      default:
        console.log("Unhandled webhook event:", event);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Still return 200 to prevent Razorpay from retrying
    return res.status(200).json({ status: "error", message: error.message });
  }
};

async function handlePaymentCaptured(payload) {
  try {
    const payment = payload.payment.entity;
    const orderId = payment.order_id;
    const paymentId = payment.id;
    const amountPaid = payment.amount / 100; // Convert paise to rupees

    console.log("Payment captured:", paymentId, "for order:", orderId);
    console.log("Amount paid:", amountPaid);

    // Find booking by Razorpay order ID
    const eventBooking = await EventBooking.findOne({
      razorpayOrderId: orderId,
    });

    if (!eventBooking) {
      console.error("Booking not found for order:", orderId);
      return;
    }

    const wasConfirmed = eventBooking.status === "confirmed";
    const totalPrice = eventBooking.totalAmount || 0;

    // Update booking with payment details
    const guestCount = eventBooking?.guest?.guestCount || 0;
    const wasConfirmed = eventBooking.status === "confirmed";

    // Increment the event's current enrolled count when transitioning
    // from not-confirmed to confirmed.
    if (!wasConfirmed && guestCount > 0) {
      await Event.findByIdAndUpdate(
        eventBooking.eventId,
        { $inc: { curPeopleEnrolled: guestCount } },
        { new: true }
      );
    }

    eventBooking.status = "confirmed";
    eventBooking.razorpayPaymentId = paymentId;

    eventBooking.amountPaid = amountPaid;

    await eventBooking.save();

    // Keep event availability in sync (used by maxPeopleAllowed checks)
    if (!wasConfirmed) {
      const increment = Number(eventBooking?.guest?.guestCount) || 1;
      await Event.findByIdAndUpdate(eventBooking.eventId, {
        $inc: { curPeopleEnrolled: increment },
      });
    }

    // Send confirmation emails
    await sendConfirmationMailToGuest(eventBooking);
    await sendConfirmationMailToAdmin(eventBooking);

    console.log("Confirmation emails sent for booking:", eventBooking._id);
  } catch (error) {
    console.error("Error handling payment captured:", error);
  }
}

async function handlePaymentFailed(payload) {
  try {
    const payment = payload.payment.entity;
    const orderId = payment.order_id;
    const paymentId = payment.id;

    console.log("Payment failed:", paymentId, "for order:", orderId);

    // Find booking
    const booking = await EventBooking.findOne({ razorpayOrderId: orderId });

    if (!booking) {
      console.error("Booking not found for order:", orderId);
      return;
    }

    // Keep status as 'pending' - user can retry payment
    console.log("Payment failed for booking:", booking._id);

    await sendPaymentFailedMailToGuest(booking);
  } catch (error) {
    console.error("Error handling payment failed:", error);
  }
}

async function handleOrderPaid(payload) {
  try {
    const order = payload.order.entity;
    const orderId = order.id;

    console.log("Order paid:", orderId);

    // This is redundant with payment.captured but can be used as backup
    const booking = await EventBooking.findOne({ razorpayOrderId: orderId });

    if (!booking) {
      console.error("Booking not found for order:", orderId);
      return;
    }

    if (booking.status !== "confirmed") {
      const increment = Number(booking?.guest?.guestCount) || 1;
      booking.status = "confirmed";
      await booking.save();
      await Event.findByIdAndUpdate(booking.eventId, {
        $inc: { curPeopleEnrolled: increment },
      });
      console.log("Booking confirmed via order.paid:", booking._id);
    }
  } catch (error) {
    console.error("Error handling order paid:", error);
  }
}

/**
 * POST /api/payment/verify
 *
 * This is called from frontend after successful payment
 * to provide immediate feedback to user before webhook arrives
 */
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Verify signature
    const text = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Find and update booking
    const booking = await EventBooking.findOne({
      razorpayOrderId: razorpay_order_id,
    });
    // console.log(booking);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const wasConfirmed = booking.status === "confirmed";

    // Update booking
    booking.status = "confirmed";
    booking.razorpayPaymentId = razorpay_payment_id;
    await booking.save();

    if (!wasConfirmed) {
      const increment = Number(booking?.guest?.guestCount) || 1;
      await Event.findByIdAndUpdate(booking.eventId, {
        $inc: { curPeopleEnrolled: increment },
      });
    }

    //  await sendConfirmationMailToGuest(booking);
    // await sendConfirmationMailToAdmin(booking)

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      booking: {
        id: booking._id,
        status: booking.status,
      },
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};
