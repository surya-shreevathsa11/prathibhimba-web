import jwt from "jsonwebtoken";

function getSecret() {
  const secret = process.env.GUEST_JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret?.trim()) {
    throw new Error("Missing GUEST_JWT_SECRET (or SESSION_SECRET fallback).");
  }
  return secret;
}

/** Guest JWT from external guest-auth (Google / PIN). Used by chatbot and guest APIs. */
export function requireGuestJwt(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = match[1].trim();
    const decoded = jwt.verify(token, getSecret());

    if (decoded.role !== "guest" || !decoded.sub || !decoded.propertyId) {
      return res.status(401).json({ message: "Invalid guest token" });
    }

    const expectedSlug = process.env.PROPERTY_SLUG?.trim();
    if (
      expectedSlug &&
      decoded.propertySlug &&
      decoded.propertySlug !== expectedSlug
    ) {
      return res.status(403).json({ message: "Token not valid for this property" });
    }

    req.guest = {
      guestUserId: decoded.sub,
      email: decoded.email,
      propertyId: decoded.propertyId,
      propertySlug: decoded.propertySlug,
    };
    return next();
  } catch (err) {
    if (err.message?.includes("Missing GUEST_JWT_SECRET")) {
      console.error(err.message);
      return res.status(500).json({ message: "Server auth misconfigured" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Sign in again." });
    }
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/** Legacy Passport session guard (disabled routes in server.js). */
export function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Please Sign-In to proceed" });
}

export default requireGuestJwt;
