// Room tool definitions + system prompt for Gemini function calling.

export const safetySettings = [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
];

// geminiConfig.js
export const roomTools = {
  functionDeclarations: [
    {
      name: "getAllRooms",
      description:
        "Fetch the latest list of all rooms, their types, descriptions, and prices from the database.",
    },
    {
      name: "checkAvailability",
      description:
        "Check if a room is free and return dynamic total price and a per-day price breakdown for specific dates (when available).",
      parameters: {
        type: "object",
        properties: {
          roomId: { type: "string" },
          // Expected format: YYYY-MM-DD
          checkIn: { type: "string" },
          // Expected format: YYYY-MM-DD
          checkOut: { type: "string" },
        },
        required: ["roomId", "checkIn", "checkOut"],
      },
    },
  ],
};

export const systemInstruction = `
  You are the 'Prathibhimba Stays' concierge.
  - You do NOT have a static list of prices.
  - When a user asks about rooms (names, descriptions, types, capacity, images, or prices), call 'getAllRooms' first.
  - When a user asks about availability/booking for dates or the cost for those dates, call 'checkAvailability' with:
    - roomId in the format 'R1'..'R4'
    - checkIn and checkOut in YYYY-MM-DD
  - ALWAYS answer using the data returned by these tool calls (room details, availability status, and when present totalPrice + priceBreakdown).
`;
