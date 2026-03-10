import mongoose from "mongoose";
const { Schema } = mongoose;
const roomIds = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"];

//this contains info about the room and the base price also
const capacitySchema = new Schema(
  {
    adults: {
      type: Number,
      required: true,
    },
    children: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const roomSchema = new Schema({
  roomId: {
    type: String,
    enum: roomIds,
    required: true,
    unique: true,
  },

  name: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    required: true,
  },

  pricePerNight: {
    type: Number,
    required: true,
  },

  capacity: capacitySchema,

  images: {
    banner: { type: String, default: null }, // main hero image
    gallery: { type: [String], default: [] }, // additional images
  },
});

const variablePriceSchema = new Schema({
  roomId: {
    type: String,
    enum: roomIds,
    required: true,
  },

  pricePerNight: {
    type: Number,
    required: true,
  },

  reason: {
    type: String,
    required: true,
  },

  from: {
    type: Date,
    required: true,
  },

  to: {
    type: Date,
    required: true,
  },
});

variablePriceSchema.index({ roomId: 1, from: 1, to: 1 });

export const VariablePrice = mongoose.model(
  "VariablePrice",
  variablePriceSchema
);

export const Room = mongoose.model("Room", roomSchema);
