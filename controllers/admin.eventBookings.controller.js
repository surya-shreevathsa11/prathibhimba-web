import mongoose from "mongoose";
import { EventBooking } from "../models/eventBooking.model.js";
import { Event } from "../models/events.model.js";
import { sendEventCancellationMailToGuest } from "../utils/eventResend.util.js";

/**
 * GET /api/admin/event-bookings
 * Query: ?status=pending|confirmed|cancelled|blocked  &eventId=<ObjectId>
 */
export const getEventBookings = async (req, res) => {
  try {
    const { status, eventId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      filter.eventId = eventId;
    }

    const bookings = await EventBooking.find(filter)
      .sort({ createdAt: -1 })
      .populate(
        "eventId",
        "name startDate endDate maxPeopleAllowed curPeopleEnrolled pricePerPerson"
      )
      .populate("userId", "name email")
      .lean();

    return res.status(200).json({ data: bookings });
  } catch (error) {
    console.error("getEventBookings:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/**
 * PATCH /api/admin/event-bookings/:eventBookingId
 * Body: { status }
 */
export const updateEventBooking = async (req, res) => {
  try {
    const { eventBookingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventBookingId)) {
      return res.status(400).json({ message: "Invalid event booking id" });
    }

    const existing = await EventBooking.findById(eventBookingId);
    if (!existing) {
      return res.status(404).json({ message: "Event booking not found" });
    }

    const status = req.body?.status;
    if (!status) return res.status(400).json({ message: "status required" });

    const validStatuses = ["pending", "confirmed", "cancelled", "blocked"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (existing.status === "confirmed" && status === "pending") {
      return res.status(400).json({
        message:
          "Cannot change confirmed booking to pending. Consider cancellation instead.",
      });
    }

    const wasConfirmed = existing.status === "confirmed";
    const guestCount = Number(existing?.guest?.guestCount) || 0;
    const releasingSpots =
      wasConfirmed && (status === "cancelled" || status === "blocked");

    if (releasingSpots && guestCount > 0) {
      const ev = await Event.findById(existing.eventId);
      if (ev) {
        ev.curPeopleEnrolled = Math.max(
          0,
          (ev.curPeopleEnrolled || 0) - guestCount
        );
        await ev.save();
      }
    }

    const updatedBooking = await EventBooking.findByIdAndUpdate(
      eventBookingId,
      { status },
      { new: true }
    );

    if (updatedBooking.status === "cancelled") {
      await sendEventCancellationMailToGuest(updatedBooking);
    }

    return res.status(200).json({
      message: "Event booking updated successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("updateEventBooking:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/**
 * DELETE /api/admin/event-bookings/:eventBookingId
 * Only allowed when status is cancelled (same rule as room bookings).
 */
export const deleteEventBooking = async (req, res) => {
  try {
    const { eventBookingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventBookingId)) {
      return res.status(400).json({ message: "Invalid event booking id" });
    }

    const booking = await EventBooking.findById(eventBookingId);
    if (!booking) {
      return res.status(404).json({ message: "Event booking not found" });
    }
    if (booking.status !== "cancelled") {
      return res.status(400).json({
        message: "Only cancelled event bookings can be deleted permanently",
      });
    }
    await EventBooking.findByIdAndDelete(eventBookingId);
    return res
      .status(200)
      .json({ message: "Event booking deleted permanently" });
  } catch (error) {
    console.error("deleteEventBooking:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
