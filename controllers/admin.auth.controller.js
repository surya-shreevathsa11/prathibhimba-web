import OTP from "../models/otp.model.js";
import { generateOTP, hashOTP } from "../utils/otp.util.js";
import { sendAdminOTPEmail } from "../utils/resend.util.js";
import jwt from "jsonwebtoken";

const generateAccessToken = () => {
  return jwt.sign(
    { username: process.env.ADMIN_USERNAME },
    process.env.ACCESSTOKEN_SECRET,
    { expiresIn: process.env.ACCESSTOKEN_EXPIRY || "24h" }
  );
};
export const login = async (req, res) => {
  try {
    const adminName = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminEmail = process.env.ADMIN_EMAIL;

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Both username and password are required",
      });
    }

    if (username !== adminName || password !== adminPassword) {
      return res.status(401).json({ message: "Incorrect credentials" });
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    //delete old otps
    await OTP.deleteMany({ identifier: username });

    await OTP.create({
      identifier: username,
      otpHash,
      expiresAt,
    });

    await sendAdminOTPEmail(adminEmail, otp);

    return res.json({
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.log(error.message, "in admin auth controller");
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { username, otp } = req.body;

    if (!username || !otp) {
      return res.status(400).json({ message: "OTP required" });
    }

    const record = await OTP.findOne({
      identifier: username,
      used: false,
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({ message: "OTP expired or not found" });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const hashed = hashOTP(otp);

    if (hashed !== record.otpHash) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    /* mark used */
    record.used = true;
    await record.save();

    const accessToken = generateAccessToken();
    return res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax", // ← strict → lax
        maxAge: 1000 * 60 * 60 * 24, // ← add this, 24h
      })
      .json({ message: "Login successful" });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};
