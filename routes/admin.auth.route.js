import { Router } from "express";
import { login, verifyOTP, logout } from "../controllers/admin.auth.controller.js";

const router = Router();

router.post("/login", login);
router.post("/verify-otp", verifyOTP);
router.post("/logout", logout);

export default router;
