import express from "express";
import cors from "cors";
import path from "path";
import "dotenv/config";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import MongoStore from "connect-mongo";

import "./config/passport.js";

//specific to esm
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import connectDB from "./db.js";

const app = express();
app.use(cookieParser());

const corsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.CORS_ORIGIN,
]
  .filter(Boolean)
  .flatMap(function (o) {
    return String(o)
      .split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  });

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "128kb" }));
// Legacy payment webhooks — moved to external backend repo
// app.use(
//   "/api/payment/razorpay-webhook",
//   express.raw({ type: "application/json" })
// );
app.use(express.static(path.join(__dirname, "public")));
app.get("/cart", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "cart.html"));
});
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});
app.get("/reviews", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "reviews.html"));
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 60 * 60 * 24,
    }),

    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      httpOnly: true,
      secure: false, // true in production (HTTPS)
      sameSite: "lax",
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ─── Active API: chatbot + session auth (booking/payments/admin → other repo) ───
import authRouter from "./routes/auth.routes.js";
import chatRouter from "./routes/chat.route.js";

// import bookingRouter from "./routes/booking.route.js";
// import razorpayRouter from "./routes/razorpay.route.js";
// import eventRazorpayRouter from "./routes/razorpayEvent.route.js";
// import eventRouter from "./routes/eventBooking.route.js";
// import adminLoginRouter from "./routes/admin.auth.route.js";
// import adminRouter from "./routes/admin.route.js";
// import { getSiteGalleryPublic } from "./controllers/admin.controller.js";
// import adminEventRouter from "./routes/admin.events.route.js";
// import publicEventsRouter from "./routes/events.route.js";

// Optional legacy Google session (frontend uses external guest-auth JWT for chat)
app.use("/api/auth", authRouter);

// Chatbot — protected by requireGuestJwt (Bearer guest token from external API)
app.use("/api/chat", chatRouter);

// app.use("/api/booking", bookingRouter);
// app.use("/api/events", publicEventsRouter);
// app.get("/api/site-gallery", getSiteGalleryPublic);
// app.use("/api/payment", razorpayRouter);
// app.use("/api/events/payment", eventRazorpayRouter);
// app.use("/api/events", eventRouter);
// app.use("/api/admin", adminLoginRouter);
// app.use("/api/admin", adminRouter);
// app.use("/api/admin/events", adminEventRouter);

// import { addInitalPrices } from "./config/addInitialRoom.js";
// addInitalPrices();

connectDB().then(() => {
  const port = Number(process.env.PORT) || 5173;
  app.listen(port, () => {
    console.log("Server running at http://localhost:" + port);
  });
});

///////////////////////////////
// import { sendConfirmationMailToGuest } from "./utils/resend.util.js";
// import { Booking } from "./models/booking.model.js";
// async function test() {
//   const booking = await Booking.findOne({
//     razorpayOrderId: "order_SQiZf5yTxyIHXc",
//   });
//   console.log(booking);
//   await sendConfirmationMailToGuest(booking);
// }
//
// test();
