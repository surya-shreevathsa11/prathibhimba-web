import { Room } from "../models/pricing.model.js";
import { rooms } from "./room.js";

export const addInitalPrices = async () => {
  try {
    const roomEntryExists = await Room.findOne({ roomId: "R1" });

    if (!roomEntryExists) {
      await Room.insertMany(
        Object.entries(rooms).map(([roomId, room]) => ({
          roomId,
          name: room.name,
          description: room.description,
          pricePerNight: room.price,
          capacity: room.capacity,
        })),
      );
    } else {
      console.log("Base Prices added");
    }
  } catch (error) {
    console.log("error adding base price");
    console.log(error.message);
  }
};
