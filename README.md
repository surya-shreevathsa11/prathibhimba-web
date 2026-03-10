# Summer Green — Homestay Website

Full-stack homestay website built with Node.js, Express, and vanilla HTML/CSS/JS.

## Setup

```bash
npm install
cp .env.sample .env
npm run dev
```

Open `http://localhost:3000`

## Stack

- **Backend:** Express, express-session, bcrypt, dotenv
- **Frontend:** Vanilla HTML/CSS/JS
- **Storage:** JSON file-based (no database)

## Structure

```
controllers/     Route handlers
models/          Data access layer (JSON)
routes/          Express route definitions
middleware/      Auth middleware
data/            JSON data storage
public/          Static frontend assets
```

## API Routes

| Method | Endpoint                | Auth | Description        |
|--------|------------------------|------|--------------------|
| POST   | /api/auth/signup       | No   | Create account     |
| POST   | /api/auth/signin       | No   | Sign in            |
| POST   | /api/auth/logout       | No   | Logout             |
| GET    | /api/auth/status       | No   | Check auth status  |
| GET    | /api/booking/rooms     | No   | Get all rooms      |
| POST   | /api/booking/book      | Yes  | Create a booking   |
| GET    | /api/booking/my-bookings| Yes  | Get user bookings  |
