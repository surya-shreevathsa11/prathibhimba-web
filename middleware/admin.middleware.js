import jwt from "jsonwebtoken";

export const verifyJWT = (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decodedToken = jwt.verify(token, process.env.ACCESSTOKEN_SECRET);

    if (decodedToken.username !== process.env.ADMIN_USERNAME) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // optional: attach user to request
    // user doesnt overlap with passport req.user cos dift scopes
    req.user = decodedToken;

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
