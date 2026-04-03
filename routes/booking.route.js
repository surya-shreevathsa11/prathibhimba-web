import express from "express";
const router = express.Router();

import {
  addToCart,
  availabilityAndPrice,
  listCart,
  listRooms,
  deleteRoomFromCart,
  bookRooms,
  listBookings,
} from "../controllers/booking.controller.js";
import {
  bookEvents,
  listEventsBooked,
} from "../controllers/eventBooking.controller.js";
import isAuthenticated from "../middleware/auth.middleware.js";

router.get("/rooms", listRooms);
router.get("/bookings", isAuthenticated, listBookings);
router.get("/cart", isAuthenticated, listCart);
router.post("/cart", isAuthenticated, addToCart);
router.post("/checkAvailability", availabilityAndPrice);
router.delete("/cart", isAuthenticated, deleteRoomFromCart);

//booking
router.post("/checkout", isAuthenticated, bookRooms);

// events booking
router.post("/events/checkout", isAuthenticated, bookEvents);
router.get("/events/bookings", isAuthenticated, listEventsBooked);

export default router;
