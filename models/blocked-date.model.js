import mongoose from "mongoose";

const { Schema } = mongoose;

const roomIds = JSON.parse(process.env.ROOM_IDS);

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
