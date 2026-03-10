// middleware/isAuthenticated.js
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next(); // session valid, user exists
  }
  res.status(401).json({ message: "Please Sign-In to proceed" });
};

export default isAuthenticated;
