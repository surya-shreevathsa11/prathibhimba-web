import { Router } from "express";
import { verifyJWT } from "../middleware/admin.middleware.js";

import {
  getBooking,
  updateBooking,
  deleteBooking,
  updateBasePrices,
  addSeasonalPrice,
  getSeasonalPrices,
  deleteSeasonalPrice,
  getBlockedDates,
  addBlockedDate,
  deleteBlockedDate,
  getRoomImages,
  updateRoomImages,
  addGalleryImage,
  removeGalleryImage,
  getCloudinarySignature,
} from "../controllers/admin.controller.js";
import {
  getEventBookings,
  updateEventBooking,
  deleteEventBooking,
} from "../controllers/admin.eventBookings.controller.js";

const router = Router();

router.get("/bookings", verifyJWT, getBooking); // Get all bookings
router.patch("/bookings/:bookingId", verifyJWT, updateBooking); // Update booking
router.delete("/bookings/:bookingId", verifyJWT, deleteBooking); // Delete cancelled booking permanently

router.get("/event-bookings", verifyJWT, getEventBookings);
router.patch("/event-bookings/:eventBookingId", verifyJWT, updateEventBooking);
router.delete("/event-bookings/:eventBookingId", verifyJWT, deleteEventBooking);

router.put("/base-price", verifyJWT, updateBasePrices);
router.post("/seasonal-price", verifyJWT, addSeasonalPrice);
router.get("/seasonal-price", verifyJWT, getSeasonalPrices);
router.delete("/seasonal-price/:id", verifyJWT, deleteSeasonalPrice);

router.get("/block-dates", verifyJWT, getBlockedDates);
router.post("/block-dates", verifyJWT, addBlockedDate);
router.delete("/block-dates/:id", verifyJWT, deleteBlockedDate);

router.get("/cloud-signature", verifyJWT, getCloudinarySignature);
router.get("/rooms/:roomId", verifyJWT, getRoomImages);
router.patch("/rooms/:roomId/images", verifyJWT, updateRoomImages);
router.patch("/rooms/:roomId/images/gallery/add", verifyJWT, addGalleryImage);
router.patch(
  "/rooms/:roomId/images/gallery/remove",
  verifyJWT,
  removeGalleryImage
);
export default router;
