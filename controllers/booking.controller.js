import { Booking } from "../models/booking.model.js";
import { Room, VariablePrice } from "../models/pricing.model.js";
import { Cart } from "../models/cart.model.js";
import { BlockedDate } from "../models/blocked-date.model.js";

function parseDateOnly(str) {
  // Parse as YYYY-MM-DD and create at UTC midnight
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)); // UTC midnight
}

async function calculateBookingPrice(roomId, checkIn, checkOut) {
  const start = parseDateOnly(checkIn);
  const end = parseDateOnly(checkOut);

  const room = await Room.findOne({ roomId });
  if (!room) throw new Error("Room not found");

  const overrides = await VariablePrice.find({
    roomId,
    from: { $lte: end },
    to: { $gte: start },
  });

  let totalPrice = 0;
  const breakdown = [];

  for (
    let date = new Date(start);
    date < end;
    date.setDate(date.getDate() + 1)
  ) {
    const currentDate = new Date(date);

    let price = room.pricePerNight;
    let reason = "Base price";

    for (const override of overrides) {
      if (currentDate >= override.from && currentDate <= override.to) {
        price = override.pricePerNight;
        reason = override.reason;
        break;
      }
    }

    totalPrice += price;

    breakdown.push({
      date: currentDate.toISOString().split("T")[0],
      price,
      reason,
    });
  }

  return {
    totalPrice,
    breakdown,
  };
}

export const checkAvailability = async (booking) => {
  try {
    const { roomId } = booking;
    const checkIn = parseDateOnly(booking.checkIn);
    const checkOut = parseDateOnly(booking.checkOut);
    const today = parseDateOnly(new Date().toISOString().slice(0, 10));

    const room = await Room.findOne({ roomId });
    if (!room) {
      return { 0: "Invalid Room Id" };
    }

    if (checkIn >= checkOut || checkIn <= today) {
      return { 0: "Please select a proper checkIn" };
    }

    // Query inside the rooms array using dot notation
    const isRoomBooked = await Booking.findOne({
      status: { $in: ["confirmed", "blocked"] },
      rooms: {
        $elemMatch: {
          roomId: roomId,
          checkOut: { $gt: checkIn },
          checkIn: { $lt: checkOut },
        },
      },
    });

    if (isRoomBooked) {
      const room = await Room.findOne({ roomId });
      return {
        0: `Room ${room.name} is unavailable for the selected dates`,
      };
    }

    // Check admin-blocked dates (from/to stored as UTC midnight; checkOut is exclusive)
    const isBlocked = await BlockedDate.findOne({
      roomId,
      from: { $lt: checkOut },
      to: { $gt: checkIn },
    });

    if (isBlocked) {
      const roomDoc = await Room.findOne({ roomId });
      return {
        0: `Room ${roomDoc.name} is blocked for the selected dates`,
      };
    }

    return { 1: "ok" };
  } catch (error) {
    console.error("error while checking availability", error);
    throw new Error("Something went wrong while checking availability");
  }
};

const validateGuests = async (guestInfo) => {
  try {
    const { roomId, adults, children } = guestInfo;

    if (Number.isNaN(Number(adults)) || Number.isNaN(Number(children))) {
      return { 0: "Invalid guest count" };
    }

    if (!adults) {
      return { 0: "Atleast one adult required" };
    }

    const roomInfo = await Room.findOne({ roomId });

    if (
      adults > roomInfo.capacity.adults ||
      children > roomInfo.capacity.adults + roomInfo.capacity.children - adults
    ) {
      return { 0: "Invalid guest Count selected" };
    }

    return { 1: "ok" };
  } catch (error) {
    console.error("error validateGuests", error);
    throw new Error("Error validating guests");
  }
};

export const availabilityAndPrice = async (req, res) => {
  try {
    const roomInfo = await Room.findOne({ roomId: req.body?.roomId });
    if (!roomInfo) {
      return res.status(400).json({ message: "Room Id required" });
    }

    const roomId = req.body.roomId;
    const checkIn = req.body.checkIn;
    const checkOut = req.body.checkOut;

    const booking = {
      roomId,
      checkIn,
      checkOut,
    };

    const isRoomAvailable = await checkAvailability(booking);
    if (!Number(Object.keys(isRoomAvailable)[0])) {
      return res.status(400).json({ message: isRoomAvailable[0] });
    }

    const pricing = await calculateBookingPrice(
      req.body.roomId,
      req.body.checkIn,
      req.body.checkOut
    );

    const bookingDetails = {
      roomId,
      checkIn: parseDateOnly(checkIn),
      checkOut: parseDateOnly(checkOut),
      price: pricing.totalPrice,
      priceBreakdown: pricing.breakdown,
    };

    return res.status(200).json(bookingDetails);
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const addToCart = async (req, res) => {
  try {
    const { roomId, checkIn, checkOut, adults, children } = req.body;

    const booking = { roomId, checkIn, checkOut };

    const isRoomAvailable = await checkAvailability(booking);
    if (!Number(Object.keys(isRoomAvailable)[0])) {
      return res.status(400).json({ message: isRoomAvailable[0] });
    }

    const guestInfo = {
      roomId,
      adults,
      children,
    };

    const guestsAllowed = await validateGuests(guestInfo);
    if (!Number(Object.keys(guestsAllowed)[0])) {
      return res.status(400).json({ message: guestsAllowed[0] });
    }

    const pricing = await calculateBookingPrice(roomId, checkIn, checkOut);

    const room = await Room.findOne({ roomId });

    const bookingDetails = {
      roomId,
      roomName: room.name,
      checkIn: parseDateOnly(checkIn),
      checkOut: parseDateOnly(checkOut),
      price: pricing.totalPrice,
      priceBreakdown: pricing.breakdown,
      adults: Number(adults),
      children: Number(children),
    };

    const userCart = await Cart.findOne({ userId: req.user._id });

    if (userCart) {
      const overlap = userCart.roomInfo.find((room) => {
        if (room.roomId !== roomId) return false;

        const existingStart = new Date(room.checkIn);
        const existingEnd = new Date(room.checkOut);

        const newStart = new Date(checkIn);
        const newEnd = new Date(checkOut);

        return newStart < existingEnd && newEnd > existingStart;
      });

      if (overlap) {
        return res.status(400).json({
          message: "This room already exists in cart with overlapping dates",
        });
      }
    }

    if (!userCart) {
      const cart = await Cart.create({
        userId: req.user._id,
        roomInfo: [bookingDetails],
      });

      return res.status(201).json(cart);
    }

    const updatedCart = await Cart.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { roomInfo: bookingDetails } },
      { returnDocument: "after" }
    );

    return res.status(200).json(updatedCart);
  } catch (error) {
    console.error("error adding to cart", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const listCart = async (req, res) => {
  try {
    const cart = await Cart.find({
      userId: req.user?._id,
    });

    return res.status(200).json({ message: cart[0]?.roomInfo });
  } catch (error) {
    console.error("error listing cart", error);
    return res.status(500).json({ message: "something went wrong" });
  }
};

export const listRooms = async (_req, res) => {
  try {
    const rooms = await Room.find({}).lean();
    const list = rooms.map((r) => ({
      id: parseInt(r.roomId.replace(/\D/g, ""), 10) || r.roomId,
      roomId: r.roomId,
      name: r.name,
      description: r.description,
      price: r.pricePerNight,
      images: r.images
        ? { banner: r.images.banner || null, gallery: r.images.gallery || [] }
        : { banner: null, gallery: [] },
    }));
    return res.status(200).json({ success: true, rooms: list });
  } catch (error) {
    console.error("error listing rooms", error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

export const deleteRoomFromCart = async (req, res) => {
  try {
    let { roomId, checkIn, checkOut } = req.body;

    if (!roomId || !checkIn || !checkOut) {
      return res
        .status(400)
        .json({ message: "roomId, checkIn and checkOut are required" });
    }

    checkIn = parseDateOnly(checkIn);
    checkOut = parseDateOnly(checkOut);

    const userCart = await Cart.findOne({ userId: req.user._id });

    if (!userCart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const roomExists = userCart.roomInfo.find(
      (room) =>
        room.roomId === roomId &&
        new Date(room.checkIn).getTime() === new Date(checkIn).getTime() &&
        new Date(room.checkOut).getTime() === new Date(checkOut).getTime()
    );

    if (!roomExists) {
      return res.status(404).json({
        message: "Room booking not found in cart",
      });
    }

    const updatedCart = await Cart.findOneAndUpdate(
      { userId: req.user._id },
      {
        $pull: {
          roomInfo: {
            roomId,
            checkIn,
            checkOut,
          },
        },
      },
      { returnDocument: "after" }
    );

    //If cart becomes empty → delete cart
    if (updatedCart.roomInfo.length === 0) {
      await Cart.deleteOne({ userId: req.user._id });
      return res.status(200).json({
        message: "Room removed and cart deleted (cart was empty)",
      });
    }

    return res.status(200).json({
      message: "Room removed from cart",
      cart: updatedCart,
    });
  } catch (error) {
    console.error("error deleting room from cart:", error.message);
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

import Razorpay from "razorpay";
import crypto from "crypto";

export const bookRooms = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res
        .status(400)
        .json({ message: "Mandatory fields must not be empty" });
    }

    const rooms = await Cart.findOne({ userId: req.user._id });
    if (!rooms) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    let totalBookingPrice = 0;
    const totalBreakDown = [];

    for (const room of rooms.roomInfo) {
      let { roomId, checkIn, checkOut, children, adults } = room;

      const booking = {
        roomId: roomId,
        checkIn: checkIn.toISOString().split("T")[0],
        checkOut: checkOut.toISOString().split("T")[0],
      };

      const isRoomAvailable = await checkAvailability(booking);
      if (!Number(Object.keys(isRoomAvailable)[0])) {
        return res.status(400).json({ message: isRoomAvailable[0] });
      }

      //guest validations and stuff not doing cos already done in cart

      const { totalPrice, breakdown } = await calculateBookingPrice(
        roomId,
        checkIn.toISOString().split("T")[0],
        checkOut.toISOString().split("T")[0]
      );

      //the total price for the whole cart
      totalBookingPrice += totalPrice;

      const roomName = await Room.findOne({ roomId });

      //price for each room
      const bookingInfo = {
        roomId: roomId,
        roomName: roomName.name,
        price: totalPrice,
        priceBreakdown: breakdown,
        adults: Number(adults),
        children: Number(children),
        checkIn: checkIn,
        checkOut: checkOut,
      };

      totalBreakDown.push(bookingInfo);
    }

    if (!totalBookingPrice) throw new Error("Unable to calculate total price ");

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const receiptId = crypto.randomBytes(6).toString("hex");

    const order = await razorpay.orders.create({
      amount: totalBookingPrice * 100,
      currency: "INR",
      receipt: `booking_${receiptId}`,
    });

    const booking = await Booking.create({
      userId: req.user._id,
      guest: {
        name,
        email,
        phone,
      },
      rooms: totalBreakDown,
      totalAmount: totalBookingPrice,
      amountPaid: 0,
      razorpayOrderId: order.id,
      status: "pending",
    });

    return res.status(201).json({
      message:
        "Booking created successfully. Complete the payment to finalize.",
      data: {
        bookingId: booking._id,
        guest: {
          name: booking.guest.name,
          email: booking.guest.email,
          phone: booking.guest.phone,
        },
        rooms: booking.rooms,
        totalAmount: booking.totalAmount,
        amountPaid: booking.amountPaid,
        razorpayOrderId: booking.razorpayOrderId,
        status: booking.status,
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("error booking room", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const listBookings = async (req, res) => {
  try {
    const today = parseDateOnly(new Date().toISOString().slice(0, 10));
    const bookings = await Booking.find({
      userId: req.user._id,
      "rooms.checkOut": { $gte: today },
      status: { $in: ["confirmed", "cancelled"] },
    }).sort({ createdAt: -1 });

    return res.status(200).json({ data: bookings });
  } catch (error) {
    console.error("error while listing bookings", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
