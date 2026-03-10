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

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "128kb" }));
app.use(
  "/api/payment/razorpay-webhook",
  express.raw({ type: "application/json" })
);
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

import authRouter from "./routes/auth.routes.js";
import bookingRouter from "./routes/booking.route.js";
import razorpayRouter from "./routes/razorpay.route.js";
import adminLoginRouter from "./routes/admin.auth.route.js";
import adminRouter from "./routes/admin.route.js";

app.use("/api/auth", authRouter);
app.use("/api/booking", bookingRouter);

//rzp and payment
//need to set to raw for webhooks to work

app.use("/api/payment", razorpayRouter);

/////////admin routes
app.use("/api/admin", adminLoginRouter);
app.use("/api/admin", adminRouter);

import { addInitalPrices } from "./config/addInitialRoom.js";
addInitalPrices();

connectDB().then(() => {
  const port = process.env.PORT;
  app.listen(port, () => {
    console.log("Server running at port", port);
  });
});

///////////////////////////////
// import { sendConfirmationMailToGuest } from "./utils/resend.util.js";
// import { Booking } from "./models/booking.model.js";
// async function test() {
//   const booking = await Booking.findOne({
//     razorpayOrderId: "order_SOcsxVr3Mskyla",
//   });
//   await sendConfirmationMailToGuest(booking);
// }
//
// test();
