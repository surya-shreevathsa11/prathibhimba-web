import mongoose from "mongoose";

const { Schema } = mongoose;

const EventBookingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    guest: {
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      guestCount: {
        type: Number,
        required: true,
        min: 1,
        max: 2,
      },
    },

    totalAmount: {
      type: Number,
      required: true,
    },
    amountPaid: {
      type: Number,
      required: true,
      default: 0,
    },

    // Razorpay payment fields
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "blocked"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const EventBooking = mongoose.model("EventBooking", EventBookingSchema);
