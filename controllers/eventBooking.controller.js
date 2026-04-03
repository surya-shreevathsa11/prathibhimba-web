import { EventBooking } from "../models/eventBooking.model.js";
import { Event } from "../models/events.model.js";
import Razorpay from "razorpay";
import crypto from "crypto";

export const bookEvents = async (req, res) => {
  try {
    const guest = req?.body?.guest;

    if (!guest?.name || !guest?.email || !guest?.phone || !guest?.guestCount) {
      return res.status(400).json({ message: "Please enter all guest fields" });
    }

    if (
      Number.isNaN(guest.guestCount) ||
      Number(guest.guestCount) > 2 ||
      Number(guest.guestCount) < 1
    ) {
      return res.status(400).json({ message: "Invalid guest count" });
    }

    const { eventId } = req?.body;
    if (!eventId) {
      return res.status(400).json({ message: "Event Id required" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(400).json({ message: "Invalid event id" });
    }

    if (
      Number(guest.guestCount) + event.curPeopleEnrolled >
      event.maxPeopleAllowed
    ) {
      const availableSpots = event.maxPeopleAllowed - event.curPeopleEnrolled;
      return res
        .status(400)
        .json({
          message: `Only ${availableSpots} slot(s) available`,
        });
    }

    const totalPrice =
      Number(event.pricePerPerson || 0) * Number(guest.guestCount);
    const amountPaise = Math.max(100, Math.round(totalPrice * 100));
    const chargedTotal = amountPaise / 100;

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const receiptId = crypto.randomBytes(6).toString("hex");

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `booking_${receiptId}`,
    });

    const guestInfo = {
      name: req.body.guest.name,
      email: req.body.guest.email,
      phone: guest.phone,
      guestCount: Number(guest.guestCount),
    };

    const eventBooking = await EventBooking.create({
      userId: req.user._id,
      eventId,
      guest: guestInfo,
      totalAmount: chargedTotal,
      amountPaid: 0,
      razorpayOrderId: order.id,
      status: "pending",
    });

    return res.status(201).json({
      message:
        "Event Booking created successfully. Complete the payment to finalize",
      data: {
        eventBookingId: eventBooking._id,
        guest: eventBooking.guest,
        totalAmount: eventBooking.totalAmount,
        amountPaid: eventBooking.amountPaid,
        razorpayOrderId: eventBooking.razorpayOrderId,
        status: eventBooking.status,
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("bookEvents:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong while booking events" });
  }
};

// GET /api/booking/events/bookings
// Lists the authenticated user's event bookings for "My Bookings"
export const listEventsBooked = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const bookings = await EventBooking.find({ userId })
      .populate("eventId")
      .lean()
      .sort({ createdAt: -1 });

    return res.status(200).json({ data: bookings });
  } catch (error) {
    console.error("Error listing event bookings:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
