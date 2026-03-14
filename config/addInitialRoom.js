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
          type: room.type,
          description: room.description,
          pricePerNight: room.price,
          capacity: room.capacity,
        }))
      );
    } else {
      // Sync room names and config from room.js to existing DB records
      for (const [roomId, room] of Object.entries(rooms)) {
        await Room.findOneAndUpdate(
          { roomId },
          {
            name: room.name,
            type: room.type,
            description: room.description,
            pricePerNight: room.price,
            capacity: room.capacity,
          }
        );
      }
      console.log("Base Prices synced");
    }
  } catch (error) {
    console.log("error adding base price");
    console.log(error.message);
  }
};
