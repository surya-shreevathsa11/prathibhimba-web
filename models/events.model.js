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

    pricePerPerson: {
      type: Number,
      min: 0,
      default: 0,
    },

    curPeopleEnrolled: {
      type: Number,
      default: 0,
      min: 0,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    banner: String,

    gallery: [String],
  },
  { timestamps: true }
);

export const Event = mongoose.model("Event", eventSchema);
