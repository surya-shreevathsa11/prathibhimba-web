import express from "express";

import {
  bookEvents,
  listUserEventBookings,
} from "../controllers/eventBooking.controller.js";
import isAuthenticated from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/bookings", isAuthenticated, listUserEventBookings);
router.post("/book", isAuthenticated, bookEvents);

export default router;
