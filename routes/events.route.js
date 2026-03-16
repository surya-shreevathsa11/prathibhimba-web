import express from "express";
import { Event } from "../models/events.model.js";

const router = express.Router();

// Public events listing for frontend
router.get("/", async (_req, res) => {
  try {
    const events = await Event.find().lean().sort({ createdAt: -1 });
    return res.status(200).json({ data: events });
  } catch (error) {
    console.error("Error listing public events:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;

