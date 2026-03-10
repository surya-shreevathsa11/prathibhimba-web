import mongoose from "mongoose";
const { Schema } = mongoose;
import { priceBreakdownSchema } from "./booking.model.js";

const roomIds = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"];

const roomInfoSchema = new Schema(
  {
    roomId: {
      type: String,
      enum: roomIds,
      required: true,
    },
    roomName: String,
    price: {
      type: Number,
      required: true,
    },
    priceBreakdown: {
      type: [priceBreakdownSchema],
      required: true,
    },
    adults: {
      type: Number,
      required: true,
    },
    children: {
      type: Number,
      required: true,
    },
    checkIn: {
      type: Date,
      required: true,
    },
    checkOut: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const cartSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roomInfo: {
      type: [roomInfoSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export const Cart = mongoose.model("Cart", cartSchema);
