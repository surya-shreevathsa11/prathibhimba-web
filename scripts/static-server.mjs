/**
 * Frontend-only static server (no MongoDB / legacy API in this repo).
 * Serves public/ and maps clean URLs (/cart, /reviews, /admin) to HTML files.
 */
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const HTML_ROUTES = {
  "/": "index.html",
  "/cart": "cart.html",
  "/reviews": "reviews.html",
  "/admin": "admin.html",
};

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

const app = express();
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
app.use(express.static(publicDir));

Object.entries(HTML_ROUTES).forEach(function ([route, file]) {
  app.get(route, function (_req, res) {
    res.sendFile(path.join(publicDir, file));
  });
});

const port = Number(process.env.PORT) || 5173;
app.listen(port, function () {
  console.log("Prathibhimba static server: http://localhost:" + port);
  console.log("  Cart:    http://localhost:" + port + "/cart");
  console.log("  API host: set API_BASE_URL in public/js/app-config.js");
});
