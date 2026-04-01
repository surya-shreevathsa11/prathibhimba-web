// routes/chat.route.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
const router = express.Router();

// Import your Mongoose models directly to fetch latest prices/details
import { Room } from "../models/pricing.model.js";
import {
  checkAvailability,
  calculateBookingPriceForChatbot,
} from "../controllers/booking.controller.js";
import {
  systemInstruction,
  roomTools,
  safetySettings,
  isUserMessageOnScope,
  CHAT_OFF_TOPIC_REPLY,
} from "../utils/geminiTools.js";
import isAuthenticated from "../middleware/auth.middleware.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview",
  systemInstruction,
  tools: [roomTools],
  safetySettings,
});

router.post("/chatbot", isAuthenticated, async (req, res) => {
  const { message, history } = req.body;

  if (message == null || typeof message !== "string") {
    return res.status(400).json({
      text: "Please send a text message.",
      history: history || [],
    });
  }

  // Hard guardrail: skip Gemini for clearly off-topic / abusive prompts
  if (!isUserMessageOnScope(message)) {
    return res.json({
      text: CHAT_OFF_TOPIC_REPLY,
      history: history || [],
    });
  }

  const chat = model.startChat({ history: history || [] });

  try {
    let result = await chat.sendMessage(message);
    let response = result.response;

    // Check if Gemini wants to call a function
    const calls = response.functionCalls?.() || [];

    if (calls.length > 0) {
      const functionResponses = [];

      for (const call of calls) {
        let functionResult;

        // Backward compatibility if something old still calls `listRooms`
        if (call.name === "listRooms" || call.name === "getAllRooms") {
          // Fetch fresh data from MongoDB
          const rooms = await Room.find({}).lean();
          // Gemini function_response expects a protobuf Struct (object), not a raw array.
          // Wrap arrays in an object to avoid "cannot start list" errors.
          functionResult = {
            rooms: rooms.map((r) => ({
              roomId: r.roomId, // e.g. "R1"
              name: r.name,
              type: r.type,
              pricePerNight: r.pricePerNight,
              price: r.pricePerNight, // alias for older prompts
              description: r.description,
              capacity: r.capacity,
              images: r.images
                ? { banner: r.images.banner || null, gallery: r.images.gallery || [] }
                : { banner: null, gallery: [] },
            })),
          };
        } else if (call.name === "checkAvailability") {
          // Normalize arg keys in case Gemini used slightly different casing
          const args = call.args || {};
          const roomId =
            args.roomId || args.roomID || args.room_id || args.room;
          const checkIn = args.checkIn || args.check_in || args.checkInDate;
          const checkOut = args.checkOut || args.check_out || args.checkOutDate;

          if (!roomId || !checkIn || !checkOut) {
            functionResult = {
              roomId: roomId || null,
              roomName: null,
              type: null,
              description: null,
              pricePerNight: null,
              capacity: null,
              status: "unavailable",
              message:
                "Missing parameters for availability. Provide roomId and checkIn/checkOut in YYYY-MM-DD.",
            };
          } else {
            // 1) Run your existing availability logic
            const availability = await checkAvailability({
              roomId,
              checkIn,
              checkOut,
            });

            // 2) Fetch the room details to give Gemini the latest info
            const roomInfo = await Room.findOne({ roomId }).lean();
            const isAvailable = availability?.[1] === "ok";

            // 3) Compute dynamic pricing for the requested dates (base + overrides)
            let pricing = null;
            if (isAvailable) {
              pricing = await calculateBookingPriceForChatbot(
                roomId,
                checkIn,
                checkOut
              );
            }

            functionResult = {
              roomId,
              roomName: roomInfo?.name || "Unknown Room",
              type: roomInfo?.type || null,
              description: roomInfo?.description || null,
              pricePerNight: roomInfo?.pricePerNight || null,
              price: roomInfo?.pricePerNight || null, // alias
              capacity: roomInfo?.capacity || null,
              status: isAvailable ? "available" : "unavailable",
              message: isAvailable ? null : availability?.[0] || "Not available for selected dates",
              // Dynamic pricing for the requested dates (only when available)
              ...(pricing
                ? { totalPrice: pricing.totalPrice, priceBreakdown: pricing.breakdown }
                : {}),
            };
          }
        } else {
          functionResult = { message: `Unsupported tool call: ${call.name}` };
        }

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: functionResult,
          },
        });
      }

      // Send the DB data back to Gemini so it can generate the final natural language response
      const finalResponse = await chat.sendMessage(functionResponses);

      return res.json({
        text: finalResponse.response.text(),
        history: await chat.getHistory(),
      });
    }

    // Standard text response if no function call was triggered
    return res.json({
      text: response.text(),
      history: await chat.getHistory(),
    });
  } catch (err) {
    console.error("Chatbot Error:", err);
    res.status(500).json({
      text: "I'm having a bit of trouble accessing the villa records right now. Please try again in a moment.",
    });
  }
});

export default router;
