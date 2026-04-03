import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { Event } from "../models/events.model.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Cloudinary signatures (banner vs images use different signed folders) ──
function respondEventImageUploadSignature(res, folder) {
  const timestamp = Math.round(Date.now() / 1000);
  const source = "uw";
  const resource_type = "image";
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, source },
    process.env.CLOUDINARY_API_SECRET
  );
  return res.status(200).json({
    signature,
    timestamp,
    folder,
    resource_type,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
  });
}

// GET /api/admin/events/cloudinary-signature/banner
export const getEventBannerCloudinarySignature = (req, res) => {
  respondEventImageUploadSignature(res, "prathibhimba/events/banner");
};

// GET /api/admin/events/cloudinary-signature/images
export const getEventImagesCloudinarySignature = (req, res) => {
  respondEventImageUploadSignature(res, "prathibhimba/events/images");
};

// GET /api/admin/events/cloudinary-signature (legacy: same folder as before)
export const getEventCloudinarySignature = (req, res) => {
  respondEventImageUploadSignature(res, "prathibhimba/events");
};

// ─── Cloudinary Signature (PDFs / Raw files) ─────────────────────────────────
// GET /api/admin/events/cloudinary-signature/raw
export const getEventCloudinaryRawSignature = (req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = "prathibhimba/events";
  const source = "uw";
  const resource_type = "raw";

  // Widget's string to sign omits resource_type; signing it caused invalid signature for raw/PDF.
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, source },
    process.env.CLOUDINARY_API_SECRET
  );

  return res.status(200).json({
    signature,
    timestamp,
    folder,
    resource_type,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
  });
};

// ─── Create ──────────────────────────────────────────────────────────────────
// POST /api/admin/events
export const createEvent = async (req, res) => {
  try {
    const {
      name,
      description,
      maxPeopleAllowed,
      startDate,
      endDate,
      banner,
      brochure,
      gallery,
    } = req.body;

    if (!name || !description || !maxPeopleAllowed || !startDate || !endDate) {
      return res.status(400).json({
        message:
          "name, description, maxPeopleAllowed, startDate and endDate are required",
      });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res
        .status(400)
        .json({ message: "startDate must be before or equal to endDate" });
    }

    const event = await Event.create({
      name,
      description,
      maxPeopleAllowed,
      startDate,
      endDate,
      banner: banner || null,
      brochure: brochure || null,
      gallery: gallery || [],
    });

    return res.status(201).json({ message: "Event created", data: event });
  } catch (error) {
    console.error("Error creating event:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── List ─────────────────────────────────────────────────────────────────────
// GET /api/admin/events
export const listEvents = async (req, res) => {
  try {
    const events = await Event.find().lean().sort({ createdAt: -1 });
    return res.status(200).json({ data: events });
  } catch (error) {
    console.error("Error listing events:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Get Single ───────────────────────────────────────────────────────────────
// GET /api/admin/events/:eventId
export const getEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res.status(200).json({ data: event });
  } catch (error) {
    console.error("Error fetching event:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Edit ─────────────────────────────────────────────────────────────────────
// PATCH /api/admin/events/:eventId
export const editEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const allowedFields = [
      "name",
      "description",
      "maxPeopleAllowed",
      "startDate",
      "endDate",
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (
      updates.startDate &&
      updates.endDate &&
      new Date(updates.startDate) > new Date(updates.endDate)
    ) {
      return res
        .status(400)
        .json({ message: "startDate must be before or equal to endDate" });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const event = await Event.findByIdAndUpdate(eventId, updates, {
      new: true,
      runValidators: true,
    });
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res.status(200).json({ message: "Event updated", data: event });
  } catch (error) {
    console.error("Error editing event:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────
// DELETE /api/admin/events/:eventId
export const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findByIdAndDelete(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res.status(200).json({ message: "Event deleted" });
  } catch (error) {
    console.error("Error deleting event:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Banner ───────────────────────────────────────────────────────────────────
// PATCH /api/admin/events/:eventId/banner
export const updateBanner = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { url } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }
    if (!url) return res.status(400).json({ message: "url is required" });

    const event = await Event.findByIdAndUpdate(
      eventId,
      { banner: url },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res
      .status(200)
      .json({ message: "Banner updated", data: { banner: event.banner } });
  } catch (error) {
    console.error("Error updating banner:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// DELETE /api/admin/events/:eventId/banner
export const removeBanner = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findByIdAndUpdate(
      eventId,
      { banner: null },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res.status(200).json({ message: "Banner removed" });
  } catch (error) {
    console.error("Error removing banner:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Brochure ─────────────────────────────────────────────────────────────────
// PATCH /api/admin/events/:eventId/brochure
export const updateBrochure = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { url } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }
    if (!url) return res.status(400).json({ message: "url is required" });

    const event = await Event.findByIdAndUpdate(
      eventId,
      { brochure: url },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res.status(200).json({
      message: "Brochure updated",
      data: { brochure: event.brochure },
    });
  } catch (error) {
    console.error("Error updating brochure:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// DELETE /api/admin/events/:eventId/brochure
export const removeBrochure = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findByIdAndUpdate(
      eventId,
      { brochure: null },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res.status(200).json({ message: "Brochure removed" });
  } catch (error) {
    console.error("Error removing brochure:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Gallery ──────────────────────────────────────────────────────────────────
// POST /api/admin/events/:eventId/gallery
export const addGalleryImage = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { url } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }
    if (!url) return res.status(400).json({ message: "url is required" });

    const event = await Event.findByIdAndUpdate(
      eventId,
      { $push: { gallery: url } },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res
      .status(200)
      .json({ message: "Image added", data: { gallery: event.gallery } });
  } catch (error) {
    console.error("Error adding gallery image:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// PATCH /api/admin/events/:eventId/gallery/remove
export const removeGalleryImage = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { url } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }
    if (!url) return res.status(400).json({ message: "url is required" });

    const event = await Event.findByIdAndUpdate(
      eventId,
      { $pull: { gallery: url } },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res
      .status(200)
      .json({ message: "Image removed", data: { gallery: event.gallery } });
  } catch (error) {
    console.error("Error removing gallery image:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Enrollments ──────────────────────────────────────────────────────────────
// DELETE /api/admin/events/:eventId/enrollments/:userId
// Cancels a specific user's enrollment and decrements the counter
export const cancelEnrollment = async (req, res) => {
  try {
    const { eventId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    // Decrement curPeopleEnrolled but never below 0
    const event = await Event.findOneAndUpdate(
      { _id: eventId, curPeopleEnrolled: { $gt: 0 } },
      { $inc: { curPeopleEnrolled: -1 } },
      { new: true }
    );
    if (!event) {
      return res
        .status(404)
        .json({ message: "Event not found or no enrollments to cancel" });
    }

    // TODO: remove the enrollment record from your Enrollment/Booking collection here
    // e.g. await Enrollment.deleteOne({ event: eventId, user: userId });

    return res.status(200).json({
      message: "Enrollment cancelled",
      data: { curPeopleEnrolled: event.curPeopleEnrolled },
    });
  } catch (error) {
    console.error("Error cancelling enrollment:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
