import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    brochure: String,

    maxPeopleAllowed: {
      type: Number,
      required: true,
      min: 1,
    },

    curPeopleEnrolled: {
      type: Number,
      default: 0,
      min: 0,
    },

    banner: String,

    gallery: [String],
  },
  { timestamps: true }
);

export const Event = mongoose.model("Event", eventSchema);
