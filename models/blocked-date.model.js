import mongoose from "mongoose";

const { Schema } = mongoose;

const roomIds = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"];

const blockedDateSchema = new Schema(
  {
    roomId: {
      type: String,
      enum: roomIds,
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
  },
  { timestamps: true }
);

blockedDateSchema.index({ roomId: 1, from: 1, to: 1 });

export const BlockedDate = mongoose.model("BlockedDate", blockedDateSchema);
