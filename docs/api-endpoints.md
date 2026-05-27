# Prathibhimba API Reference

Base URL: your server origin (e.g. `http://localhost:<PORT>` in development).

All JSON APIs use `Content-Type: application/json` unless noted.

---

## Authentication

| Type | Used by | How |
|------|---------|-----|
| **Google session** | Guest booking, cart, chat | Passport session cookie after `GET /api/auth/google` flow. Required middleware: `isAuthenticated`. |
| **Admin JWT** | Admin panel APIs | HTTP-only cookie `accessToken` (set on OTP verify) or header `Authorization: Bearer <token>`. Middleware: `verifyJWT` (must match `ADMIN_USERNAME` in token). |
| **Razorpay webhook** | Payment webhooks | Header `x-razorpay-signature` verified with `RAZORPAY_WEBHOOK_SECRET`. |
| **None** | Public listings, availability check | — |

CORS is enabled with `credentials: true` (`CORS_ORIGIN` in `.env`).

---

## Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/google` | — | Starts Google OAuth (`profile`, `email` scope). Redirects to Google. |
| `GET` | `/google/callback` | — | OAuth callback. On success, saves session and redirects to `/`. |
| `GET` | `/status` | — | Returns `{ loggedIn: true, user }` or `{ loggedIn: false }`. |
| `POST` | `/logout` | Session | Destroys session; returns `{ success: true }`. |

---

## Rooms & bookings (guest) — `/api/booking`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/rooms` | — | Lists all rooms with id, name, type, price, capacity, images. |
| `POST` | `/checkAvailability` | — | Checks availability and returns price for dates. **Body:** `{ roomId, checkIn, checkOut }` (dates as `YYYY-MM-DD`). **Response:** `{ roomId, checkIn, checkOut, price, priceBreakdown }`. |
| `GET` | `/cart` | Google session | Returns cart line items (`roomInfo` array) for the signed-in user. |
| `POST` | `/cart` | Google session | Adds a room stay to cart. Validates availability, guest counts, pricing. **Body:** `{ roomId, checkIn, checkOut, adults, children }`. Rejects overlapping same-room dates in cart. |
| `DELETE` | `/cart` | Google session | Removes one cart line. **Body:** `{ roomId, checkIn, checkOut }` (must match stored dates). |
| `POST` | `/checkout` | Google session | Creates a **room** `Booking` + Razorpay order from cart. **Body:** `{ name, email, phone }`. Re-validates availability and pricing server-side. **Response:** booking id, guest, rooms, `totalAmount`, `razorpayOrderId`, `key` (Razorpay key id). |
| `GET` | `/bookings` | Google session | Lists user’s room bookings with `checkOut >= today` and status `confirmed` or `cancelled`. |

### Event booking (also under `/api/booking`)

Duplicate handlers exist under `/api/events` (see below). Prefer one path in the frontend.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/events/checkout` | Google session | Same as `POST /api/events/book`. Creates `EventBooking` + Razorpay order. |
| `GET` | `/events/bookings` | Google session | Same as `GET /api/events/bookings`. Lists user’s event bookings with populated event fields. |

**`POST` event checkout body:**

```json
{
  "eventId": "<ObjectId>",
  "guest": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "guestCount": 1
  }
}
```

- `guestCount`: 1–2 (schema max).
- `totalAmount` = `event.pricePerPerson × guestCount` (minimum Razorpay charge: **₹1** / 100 paise if total is 0).

---

## Public events — `/api/events`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | — | Lists all events (newest first). Includes `pricePerPerson`, dates, capacity, media URLs, etc. |

---

## Event booking (alternate mount) — `/api/events`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/book` | Google session | Create event booking + Razorpay order (see body above). |
| `GET` | `/bookings` | Google session | List signed-in user’s event bookings (`eventId` populated). |

---

## Chat — `/api/chat`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/chatbot` | Google session | Gemini-powered assistant for rooms/availability/pricing. **Body:** `{ message: string, history?: array }`. May call tools `getAllRooms` / `checkAvailability` against live DB. Off-topic messages get a fixed refusal without calling the model. **Response:** `{ text, history }`. |

---

## Site gallery (public) — `/api`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/site-gallery` | — | Returns `{ images: string[] }` for homepage gallery (Cloudinary URLs). |

---

## Payments — Razorpay

### Room stays — `/api/payment`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/razorpay-webhook` | Razorpay signature | Room booking webhook. **Raw JSON body** (required for signature). Handles `payment.captured`, `payment.failed`, `order.paid`. On capture: confirms `Booking`, sets `amountPaid`, sends guest/admin emails, clears user cart. |
| `POST` | `/verify` | — | Client callback after checkout. **Body:** `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`. Verifies HMAC with `RAZORPAY_KEY_SECRET`, confirms booking. |
| `POST` | `/razorpay-event-webhook` | Razorpay signature | Event booking webhook (same event types as above). Uses **parsed** JSON body (not the raw middleware path). |
| `POST` | `/verify-event` | — | Event payment verify (same body as `/verify`). Confirms `EventBooking`, increments `Event.curPeopleEnrolled`. |

### Event stays (alternate mount) — `/api/events/payment`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/razorpay-webhook` | Razorpay signature | Same handler as `/api/payment/razorpay-event-webhook`. |
| `POST` | `/verify` | — | Same handler as `/api/payment/verify-event`. |

**Razorpay dashboard:** subscribe to `payment.captured`, `payment.failed`, and optionally `order.paid`.

**Webhook URLs (production examples):**

- Rooms: `https://<host>/api/payment/razorpay-webhook`
- Events: `https://<host>/api/payment/razorpay-event-webhook` **or** `https://<host>/api/events/payment/razorpay-webhook` (configure one; both exist in code).

---

## Admin auth — `/api/admin`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/login` | — | **Body:** `{ username, password }`. If credentials match env admin, emails OTP and returns `{ message }`. |
| `POST` | `/verify-otp` | — | **Body:** `{ username, otp }`. Sets `accessToken` cookie on success. |
| `POST` | `/logout` | — | Clears `accessToken` cookie. |

---

## Admin — rooms, pricing, bookings — `/api/admin`

All routes below require **Admin JWT** unless noted.

### Room bookings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/bookings` | List bookings. **Query:** `?status=`, `?upcoming=true` (filters `rooms.checkOut >= today`). |
| `PATCH` | `/bookings/:bookingId` | **Body:** `{ status }` — `pending` \| `confirmed` \| `cancelled` \| `blocked`. Sends cancellation email if set to `cancelled`. |
| `DELETE` | `/bookings/:bookingId` | Permanently deletes booking only if `status === "cancelled"`. |

### Event bookings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/event-bookings` | List event bookings. **Query:** `?status=`, `?eventId=`. Populates event + user. |
| `PATCH` | `/event-bookings/:eventBookingId` | **Body:** `{ status }`. On cancel/block from `confirmed`, decrements `Event.curPeopleEnrolled`. Cancellation email if cancelled. |
| `DELETE` | `/event-bookings/:eventBookingId` | Delete only if `status === "cancelled"`. |

### Pricing

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/base-price` | **Body:** `{ rooms: [{ roomId, pricePerNight }] }`. Updates base nightly rates. |
| `GET` | `/seasonal-price` | List seasonal overrides. **Query:** `?roomId=`. |
| `POST` | `/seasonal-price` | **Body:** `{ roomId, pricePerNight, reason, from, to }`. Rejects overlapping rules for same room. |
| `DELETE` | `/seasonal-price/:id` | Remove a seasonal price rule. |

### Blocked dates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/block-dates` | List blocks. **Query:** `?roomId=`. |
| `POST` | `/block-dates` | **Body:** `{ roomId, from, to }` (`YYYY-MM-DD`). |
| `DELETE` | `/block-dates/:id` | Remove a block. |

### Room & site images (Cloudinary)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cloud-signature` | Signed upload params for admin room/site uploads (`folder: prathibhimba`). |
| `GET` | `/site-gallery` | Admin read of site gallery URLs (same shape as public). |
| `PATCH` | `/site-gallery/add` | **Body:** `{ url }`. Append image URL. |
| `PATCH` | `/site-gallery/remove` | **Body:** `{ url }`. Remove image URL. |
| `GET` | `/rooms/:roomId` | Get room image metadata. |
| `PATCH` | `/rooms/:roomId/images` | Update room banner/gallery. **Body:** image fields per controller. |
| `PATCH` | `/rooms/:roomId/images/gallery/add` | **Body:** `{ url }`. |
| `PATCH` | `/rooms/:roomId/images/gallery/remove` | **Body:** `{ url }`. |

---

## Admin — events — `/api/admin/events`

All routes require **Admin JWT** (`router.use(verifyJWT)`).

### Cloudinary signatures

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cloudinary-signature/banner` | Sign upload to `prathibhimba/events/banner`. |
| `GET` | `/cloudinary-signature/images` | Sign upload to `prathibhimba/events/images`. |
| `GET` | `/cloudinary-signature/raw` | Sign PDF/raw upload to `prathibhimba/events`. |
| `GET` | `/cloudinary-signature` | Legacy image signature (`prathibhimba/events`). |

### CRUD

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create event. **Required:** `name`, `description`, `maxPeopleAllowed`, `startDate`, `endDate`. **Optional:** `pricePerPerson` (default `0`), `banner`, `brochure`, `gallery[]`. |
| `GET` | `/` | List all events (admin). |
| `GET` | `/:eventId` | Get one event. |
| `PATCH` | `/:eventId` | Update allowed fields: `name`, `description`, `maxPeopleAllowed`, `pricePerPerson`, `startDate`, `endDate`. |
| `DELETE` | `/:eventId` | Delete event document. |

### Event media

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/:eventId/banner` | **Body:** `{ url }`. Set banner URL. |
| `DELETE` | `/:eventId/banner` | Clear banner. |
| `PATCH` | `/:eventId/brochure` | **Body:** `{ url }`. Set brochure PDF URL. |
| `DELETE` | `/:eventId/brochure` | Clear brochure. |
| `POST` | `/:eventId/gallery` | **Body:** `{ url }`. Push gallery image. |
| `PATCH` | `/:eventId/gallery/remove` | **Body:** `{ url }`. Pull gallery image. |

### Enrollments

| Method | Path | Description |
|--------|------|-------------|
| `DELETE` | `/:eventId/enrollments/:userId` | Decrements `curPeopleEnrolled` by 1 (if &gt; 0). Does not delete `EventBooking` records (TODO in code). |

---

## Static / HTML routes (not JSON APIs)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | `public/index.html` (static). |
| `GET` | `/cart` | Cart page. |
| `GET` | `/admin` | Admin panel. |
| `GET` | `/reviews` | Reviews page. |
| — | `/public/*` | Static assets (CSS, JS, images). |

---

## Booking status values

Used on `Booking` and `EventBooking`:

`pending` → `confirmed` → `cancelled` | `blocked`

- **pending:** Razorpay order created, payment not completed.
- **confirmed:** Payment verified (webhook and/or `/verify`).
- **cancelled:** Admin or flow cancelled; room bookings may be deleted permanently.
- **blocked:** Admin-held state (e.g. manual block).

---

## Duplicate endpoints (cleanup candidates)

| Function | Path A | Path B |
|----------|--------|--------|
| Event checkout | `POST /api/booking/events/checkout` | `POST /api/events/book` |
| User event bookings | `GET /api/booking/events/bookings` | `GET /api/events/bookings` |
| Event Razorpay webhook | `POST /api/payment/razorpay-event-webhook` | `POST /api/events/payment/razorpay-webhook` |
| Event payment verify | `POST /api/payment/verify-event` | `POST /api/events/payment/verify` |

Use one URL per environment in Razorpay and the frontend to avoid double-processing.

---

## Related docs

- [OAuth setup](./oauth.md)
- [Cloudinary uploads](./cloudinary.md)
- [Rooms config](./rooms.md)

---

*Generated from route files in `server.js` and `routes/`.*
