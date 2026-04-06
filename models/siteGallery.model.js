import mongoose from "mongoose";
const { Schema } = mongoose;

const siteGallerySchema = new Schema(
  {
    images: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const SiteGallery = mongoose.model("SiteGallery", siteGallerySchema);
