# Frontend → Vara migration (Prathibhimba)

Guest booking UI talks to **Vara** at `https://api.varalabs.in` with property slug **`prathibhimba`**.

Config: `public/js/app-config.js`  
API client: `public/js/api/varaClient.js` (`window.VaraApi`)  
Consumers: `public/js/main.js`, `public/js/cart.js`

Admin (`admin.js`) and chatbot (`/api/chat/chatbot`) remain out of scope for this guest migration.

---

## Config

| Key | Value |
|-----|--------|
| `API_BASE_URL` | `https://api.varalabs.in` |
| `PROPERTY_SLUG` | `prathibhimba` |
| Guest JWT storage | `localStorage.guestAccessToken` |
| Auth header | `Authorization: Bearer <token>` |

---

## Endpoint migration matrix

| Legacy (this repo) | Vara | Auth | Adapter / notes |
|--------------------|------|------|-----------------|
| `GET /api/booking/rooms` | `GET /api/public/properties/:slug/rooms` | Public | `adapters.rooms` — `price` / `pricePerNight` |
| `POST /api/booking/checkAvailability` | `POST /api/public/properties/:slug/quote` | Public | `adapters.quote` |
| *(signed-in quote)* | `POST /api/guest/bookings/quote` | Bearer | Available on client; UI uses public quote |
| `GET /api/booking/cart` | `GET /api/guest/bookings/cart` | Bearer | `adapters.cart` — `roomInfo` / `items` |
| `POST /api/booking/cart` | `POST /api/guest/bookings/cart/items` | Bearer | Body: `{ roomId, checkIn, checkOut, adults, children }` |
| `DELETE /api/booking/cart` | `DELETE /api/guest/bookings/cart/items` | Bearer | Body: `{ roomId, checkIn, checkOut }` |
| `POST /api/booking/checkout` | `POST /api/guest/payments/order` | Bearer | `adapters.paymentOrder` — `key`, `razorpayOrderId` |
| `POST /api/payment/verify` | `POST /api/guest/payments/verify` | Bearer | Razorpay signature fields |
| `GET /api/booking/bookings` | `GET /api/guest/bookings` | Bearer | `adapters.bookings` |
| `GET /api/events` | `GET /api/public/properties/:slug/events` | Public | `adapters.events` |
| `POST /api/booking/events/checkout` / `POST /api/events/book` | `POST /api/guest/event-bookings` | Bearer | Free → confirmed; paid → order+key; `403` if events disabled |
| `POST /api/payment/verify-event` | `POST /api/guest/event-payments/verify` | Bearer | No separate event `/order` |
| `GET /api/booking/events/bookings` | `GET /api/guest/event-bookings` | Bearer | — |
| `GET /api/auth/google` (redirect) | `POST /api/guest-auth/google` | None → JWT | GIS `credential` + `propertySlug` |
| `GET /api/auth/status` | *(local JWT)* | — | `guestProfileFromToken` |
| `POST /api/auth/logout` | *(client clear)* | — | `VaraApi.clearGuestToken()` |
| *(new)* | `POST /api/guest-auth/request-pin` | None | Wired on client; no PIN UI yet |
| *(new)* | `POST /api/guest-auth/verify-pin` | None → JWT | Wired on client; no PIN UI yet |
| `GET /api/site-gallery` | `GET /api/public/properties/:slug/site-gallery` | Public | `adapters.siteGallery` |
| `GET /api/guest/bookings/rooms` | Same | Bearer | Available on client |

---

## Changed files

| File | Summary |
|------|---------|
| `public/js/app-config.js` | Base URL → `https://api.varalabs.in` |
| `public/js/api/varaClient.js` | **New** centralized client, token handling, adapters, all guest/public methods |
| `public/js/main.js` | Uses `VaraApi`; free-event confirm; 401 handling; rooms/events/quote/cart/bookings |
| `public/js/cart.js` | Uses `VaraApi`; room payment order + verify; Razorpay name → Prathibhimba |
| `public/index.html` | Loads `varaClient.js` before `main.js` |
| `public/cart.html` | Loads `varaClient.js` before `cart.js` |
| `docs/frontend_vara_migration.md` | This report |

---

## UI behavior changes required by backend contract

1. **Free events** — If `pricePerPerson * guestCount === 0`, `POST /api/guest/event-bookings` confirms immediately. UI shows success and does **not** open Razorpay. Submit label becomes “Confirm booking”.
2. **Paid events** — Same POST returns `razorpayOrderId` + `key`; Razorpay opens; verify via `/api/guest/event-payments/verify` (no separate order endpoint).
3. **`guestCount`** — Must be `1` or `2` (enforced in form + client).
4. **`eventsEnabled: false`** — API returns `403`; UI shows a clear message.
5. **Auth** — Guest JWT in `localStorage`; 401 clears token and fires `vara:auth-required`.
6. **Razorpay branding** — Checkout display name is **Prathibhimba** (rooms + events).

---

## Known risks / follow-ups

- **PIN login** — Client methods exist; sign-in modal is Google-only.
- **Admin panel** — Still legacy same-origin `/api/admin/*`.
- **Chatbot** — Still same-origin `/api/chat/chatbot` (needs local Express + matching `GUEST_JWT_SECRET`).
- **CORS** — Frontend origin must be allowed on `api.varalabs.in`.
- **Google OAuth** — GIS client ID must list this site’s origin.
- **Cart DELETE** — Still keyed by `{ roomId, checkIn, checkOut }`; switch to `itemId` if backend changes.
- **Network smoke** — Could not hit the live API from this environment; verify with the QA checklist below.

---

## Manual QA checklist

### Setup

1. Serve static frontend (`npm run serve`).
2. Confirm DevTools → Network calls go to `https://api.varalabs.in/...`.
3. Confirm `PROPERTY_SLUG=prathibhimba` in requests (public URLs).

### Public listing

4. Homepage loads **rooms** from `/api/public/properties/prathibhimba/rooms`.
5. **Events** carousel loads from `.../events`.
6. Site gallery loads from `.../site-gallery` (or falls back to defaults).

### Quote + cart (rooms)

7. Open “Add to cart” → pick dates → availability uses `POST .../quote`.
8. Without sign-in → prompted to Google sign-in.
9. Sign in → token stored → `POST /api/guest/bookings/cart/items` succeeds.
10. Cart page lists items via `GET /api/guest/bookings/cart`.
11. Remove item via `DELETE /api/guest/bookings/cart/items`.

### Room payment

12. Checkout → terms → `POST /api/guest/payments/order` returns key + order id.
13. Razorpay opens as **Prathibhimba**.
14. Success → `POST /api/guest/payments/verify` → redirect `/?payment=success`.

### Event booking — paid

15. Sign in → book paid event (`guestCount` 1 or 2).
16. `POST /api/guest/event-bookings` returns order fields → Razorpay opens.
17. Success → `POST /api/guest/event-payments/verify`.

### Event booking — free

18. Book free event (`pricePerPerson * guestCount === 0`).
19. Booking confirms **without** Razorpay; success message shown.

### History + auth

20. Profile → My Bookings loads rooms + events lists.
21. Logout clears token; protected calls require sign-in again.
22. Expired/invalid token → 401 → sign-in prompt.

### Negative cases

23. Invalid dates on quote → error message.
24. Event with no spots → submit disabled.
25. If events disabled on property → 403 message on book.
