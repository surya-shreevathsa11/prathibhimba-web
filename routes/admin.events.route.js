import express from "express";
import { verifyJWT } from "../middleware/admin.middleware.js";
import {
  createEvent,
  listEvents,
  getEvent,
  editEvent,
  deleteEvent,
  updateBanner,
  removeBanner,
  updateBrochure,
  removeBrochure,
  addGalleryImage,
  removeGalleryImage,
  cancelEnrollment,
  getEventCloudinarySignature,
  getEventBannerCloudinarySignature,
  getEventImagesCloudinarySignature,
  getEventCloudinaryRawSignature,
} from "../controllers/admin.events.controller.js";

const router = express.Router();

router.use(verifyJWT);

// Cloudinary (banner and images each get their own signed folder)
router.get("/cloudinary-signature/banner", getEventBannerCloudinarySignature);
router.get("/cloudinary-signature/images", getEventImagesCloudinarySignature);
router.get("/cloudinary-signature/raw", getEventCloudinaryRawSignature); // PDFs
router.get("/cloudinary-signature", getEventCloudinarySignature);

// CRUD
router.post("/", createEvent);
router.get("/", listEvents);
router.get("/:eventId", getEvent);
router.patch("/:eventId", editEvent);
router.delete("/:eventId", deleteEvent);

// Banner
router.patch("/:eventId/banner", updateBanner);
router.delete("/:eventId/banner", removeBanner);

// Brochure
router.patch("/:eventId/brochure", updateBrochure);
router.delete("/:eventId/brochure", removeBrochure);

// Gallery
router.post("/:eventId/gallery", addGalleryImage);
router.patch("/:eventId/gallery/remove", removeGalleryImage);

// Enrollments
router.delete("/:eventId/enrollments/:userId", cancelEnrollment);

export default router;
