# Guest API migration: Prathibhimba → multi-property backend

Maps every **guest-facing** call in the Prathibhimba frontend (`public/js/main.js`, `public/js/cart.js`) to the canonical routes in the **new** Express backend (`server/server.js`).

**Out of scope (do not migrate):**

- `/api/chat/*` (chatbot)
- All `/api/admin/*` and `/api/manager/*`

**Note:** The new backend repo was not present in this workspace when this doc was written. Endpoint paths below match the canonical list you provided; request/response field names marked **verify in target repo** should be confirmed against `server/routes/*` controllers before coding.

---

## Property scoping (required change)

The old app is single-property (implicit). The new backend is **property-scoped**.

| Config | Purpose |
|--------|---------|
| `API_BASE_URL` | e.g. `https://api.example.com` or `http://localhost:3000` |
| `PROPERTY_SLUG` | e.g. `prathibhimba` — one slug per deployed frontend |

```javascript
// Example helper (guest frontend)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const PROPERTY_SLUG = import.meta.env.VITE_PROPERTY_SLUG || "prathibhimba";

function publicUrl(path) {
  return `${API_BASE}/api/public/properties/${PROPERTY_SLUG}${path}`;
}
function guestUrl(path) {
  return `${API_BASE}/api/guest${path}`;
}
function guestAuthUrl(path) {
  return `${API_BASE}/api/guest-auth${path}`;
}
```

Public routes embed `:propertySlug`. Guest routes rely on **`requirePropertyBookingAccess`** (property context from JWT and/or headers — **verify in target repo**).

---

## Auth model change (critical)

| Old (Prathibhimba) | New backend |
|--------------------|-------------|
| Passport **session cookie** after `GET /api/auth/google` redirect | **Guest JWT** from PIN or Google sign-in |
| `fetch(..., { credentials: "same-origin" })` | `Authorization: Bearer <guestJwt>` on guest routes (**verify** if cookie is also set) |
| `GET /api/auth/status` | **No direct equivalent** in canonical list — derive logged-in state from stored JWT + profile returned by auth endpoints |
| `POST /api/auth/logout` | **No canonical logout route** — clear JWT client-side; call server logout only if target repo adds it |

### Recommended guest auth flow

1. **PIN:** `POST /api/guest-auth/request-pin` → `POST /api/guest-auth/verify-pin` → store JWT.
2. **Google:** `POST /api/guest-auth/google` with Google ID token (not browser redirect to `/api/auth/google`) → store JWT.
3. Attach JWT to all `/api/guest/*` requests.
4. Replace every `credentials: "same-origin"` auth-dependent call with explicit `Authorization` header (and `credentials: "include"` only if the new backend sets httpOnly guest cookies — **verify in target repo**).

---

## Mapping table

| Old endpoint | Old auth | New endpoint(s) | New auth | Request changes | Response differences (frontend impact) | Notes |
|--------------|----------|-----------------|----------|-----------------|----------------------------------------|-------|
| `GET /api/auth/google` | None (redirect) | `POST /api/guest-auth/google` | None → returns JWT | Send Google **ID token** (or payload shape defined in target repo), not a full-page redirect | Old: redirect + session. New: JSON + JWT. Rewrite sign-in UI (Google Identity Services / One Tap). | Remove `window.location.href = "/api/auth/google"`. |
| `GET /api/auth/status` | Session cookie | *(none)* | — | Store `{ name, email, ... }` from verify-pin / google responses | Old: `{ loggedIn, user }`. New: no status poll unless target repo adds `/me`. | Use local JWT expiry + cached profile. |
| `POST /api/auth/logout` | Session | *(none in canonical list)* | — | Clear `localStorage`/memory JWT | — | **Gap:** no server logout in canonical routes. |
| `POST /api/guest-auth/request-pin` | — | Same | None | **New:** email/phone body per target repo | — | **New capability** (no old equivalent). |
| `POST /api/guest-auth/verify-pin` | — | Same | Returns guest JWT | **New** | — | **New capability**. |
| `GET /api/booking/rooms` | None | `GET /api/public/properties/:propertySlug/rooms` | Public | URL only | Old: `{ success, rooms: [{ id, roomId, name, type, price, capacity, images }] }`. New: **verify** wrapper (`data` vs `rooms`). Map `price` → `pricePerNight` if renamed. | Use **public** route for homepage before login. |
| `GET /api/booking/rooms` | Session (optional) | `GET /api/guest/bookings/rooms` | Guest JWT + property access | Same query as public if any | Same as public variant | Use when guest-specific pricing/overrides exist (**verify**). |
| `POST /api/booking/checkAvailability` | None | `POST /api/public/properties/:propertySlug/quote` | Public | Body: `{ roomId, checkIn, checkOut }` (keep `YYYY-MM-DD`) | Old: `{ roomId, checkIn, checkOut, price, priceBreakdown }`. New quote likely `{ available, totalPrice, breakdown }` or similar — **verify** field names. | Use public quote on book-room modal **before** login. |
| `POST /api/booking/checkAvailability` | Session | `POST /api/guest/bookings/quote` | Guest JWT + property access | Same body | Same shape as public quote | Use when user is signed in (optional optimization). |
| `GET /api/booking/cart` | Session | `GET /api/guest/bookings/cart` | Guest JWT + property access | — | Old: `{ message: roomInfo[] }` (array in `message`). New: likely `{ data: { items \| roomInfo } }` — **verify**. | Update cart count: `data.items.length` not `message.length`. |
| `POST /api/booking/cart` | Session | `POST /api/guest/bookings/cart/items` | Guest JWT + property access | Body: `{ roomId, checkIn, checkOut, adults, children }` | Returns full cart object — **verify** shape | Path rename only if body unchanged. |
| `DELETE /api/booking/cart` | Session | `DELETE /api/guest/bookings/cart/items` | Guest JWT + property access | Old body: `{ roomId, checkIn, checkOut }`. New may use item id — **verify** | — | If new API uses `itemId`, store id when adding to cart. |
| `POST /api/booking/checkout` | Session | `POST /api/guest/payments/order` | Guest JWT + property access | Old body: `{ name, email, phone }` (cart read server-side). New may require `{ guest: { name, email, phone } }` and/or explicit cart reference — **verify** | Old: `{ data: { bookingId, totalAmount, razorpayOrderId, key, rooms, ... } }`. New: **verify** `key` vs `razorpayKeyId`, `orderId` vs `razorpayOrderId`. | **Split:** checkout + order creation may be one step in new API. Update `cart.js` handler. |
| `GET /api/booking/bookings` | Session | `GET /api/guest/bookings` | Guest JWT + property access | Old filters upcoming confirmed/cancelled server-side | Old: `{ data: bookings[] }` with embedded `rooms`. New: **verify** filter query params (`?upcoming=true`). | May unify room + event lists — **verify** if events are separate (below). |
| `GET /api/events` | None | `GET /api/public/properties/:propertySlug/events` | Public | URL only | Old: `{ data: events[] }`. New: likely `{ data: events[] }` — **verify** | Update `main.js` events fetch URL. |
| `GET /api/booking/events/bookings` | Session | `GET /api/guest/event-bookings` | Guest JWT + property access | — | Old: `{ data: [...] }` with populated `eventId`. New: **verify** populate shape. | Remove duplicate `GET /api/events/bookings` usage. |
| `GET /api/events/bookings` | Session | `GET /api/guest/event-bookings` | Guest JWT + property access | — | Same | **Duplicate** old route — use one new endpoint. |
| `POST /api/booking/events/checkout` | Session | `POST /api/guest/event-bookings` | Guest JWT + property access | Body: `{ eventId, guest: { name, email, phone, guestCount } }` | Old returns Razorpay fields in `data`. New may return order in same response or separate payment step — **verify** | Update `main.js` book-event flow. |
| `POST /api/events/book` | Session | `POST /api/guest/event-bookings` | Guest JWT + property access | Same body | Same | **Duplicate** old route — remove one caller. |
| `POST /api/payment/verify` | None (signature) | `POST /api/guest/payments/verify` | Guest JWT + property access ( **verify** ) | Body unchanged: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | Old: `{ success, booking: { id, status } }`. New: **verify** | Update `cart.js` Razorpay handler. |
| `POST /api/payment/verify-event` | None | `POST /api/guest/event-payments/verify` | Guest JWT + property access ( **verify** ) | Same Razorpay body | Old: `{ success, booking: { id, status } }` | Update `main.js` event Razorpay handler. |
| `POST /api/events/payment/verify` | None | `POST /api/guest/event-payments/verify` | Same | Same | Same | **Duplicate** old route. |
| `POST /api/payment/razorpay-webhook` | Razorpay HMAC | `POST /api/guest/payments/webhook` | Webhook secret (raw body) | Razorpay dashboard URL only | N/A (server) | **Raw JSON body** required. Not a frontend change. |
| `POST /api/payment/razorpay-event-webhook` | Razorpay HMAC | `POST /api/guest/event-payments/webhook` | Webhook secret (raw body) | Dashboard URL only | N/A | Remove old duplicate webhook URLs. |
| `POST /api/events/payment/razorpay-webhook` | Razorpay HMAC | `POST /api/guest/event-payments/webhook` | Same | Same | N/A | **Duplicate** old webhook. |
| `GET /api/site-gallery` | None | `GET /api/public/properties/:propertySlug/site-gallery` | Public | URL only | Old: `{ images: string[] }`. New: **verify** (`data.images` vs `images`). | Update `loadSiteGalleryReel` in `main.js`. |
| `POST /api/chat/chatbot` | Session | *(ignore)* | — | — | — | **Remove** chat UI calls or disable feature. |
| *(none)* | — | `POST /api/inquiries` | Public or guest (**verify**) | **New:** contact form body per target repo | — | **New capability** — wire contact forms if needed. |

---

## Frontend file change checklist

### Shared API module (recommended)

Create `public/js/api.js` (or similar):

```javascript
const API_BASE = window.__ENV__?.API_BASE_URL || "";
const PROPERTY_SLUG = window.__ENV__?.PROPERTY_SLUG || "prathibhimba";
const GUEST_TOKEN_KEY = "guestAccessToken";

export function getGuestToken() {
  return localStorage.getItem(GUEST_TOKEN_KEY);
}
export function setGuestToken(token) {
  if (token) localStorage.setItem(GUEST_TOKEN_KEY, token);
  else localStorage.removeItem(GUEST_TOKEN_KEY);
}

export function guestHeaders(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  const t = getGuestToken();
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

export function apiFetch(url, opts = {}) {
  return fetch(`${API_BASE}${url}`, {
    ...opts,
    headers: { ...guestHeaders(), ...(opts.headers || {}) },
    // Use include only if new backend sets auth cookies:
    credentials: opts.credentials ?? "same-origin",
  });
}
```

Inject `API_BASE_URL` and `PROPERTY_SLUG` via env at build time or a small `config.js` script tag.

### `public/js/main.js`

| Current call | Replace with |
|--------------|--------------|
| `fetch("/api/booking/rooms")` | `fetch(publicUrl("/rooms"))` |
| `fetch("/api/booking/checkAvailability", …)` | `fetch(publicUrl("/quote"), …)` or `fetch(guestUrl("/bookings/quote"), …)` if logged in |
| `fetch("/api/booking/cart", …)` | `apiFetch(guestUrl("/bookings/cart"))` |
| `fetch("/api/booking/bookings", …)` | `apiFetch(guestUrl("/bookings"))` |
| `fetch("/api/booking/events/bookings", …)` | `apiFetch(guestUrl("/event-bookings"))` |
| `fetch("/api/booking/events/checkout", …)` | `apiFetch(guestUrl("/event-bookings"), { method: "POST", … })` |
| `fetch("/api/payment/verify-event", …)` | `apiFetch(guestUrl("/event-payments/verify"), …)` |
| `fetch("/api/events")` | `fetch(publicUrl("/events"))` |
| `fetch("/api/site-gallery")` | `fetch(publicUrl("/site-gallery"))` |
| `fetch("/api/auth/status", …)` | Local JWT + profile cache; optional new `/me` if added later |
| `window.location.href = "/api/auth/google"` | Google sign-in → `POST /api/guest-auth/google` |
| `fetch("/api/auth/logout", …)` | `setGuestToken(null)` + UI reset |
| `fetch("/api/chat/chatbot", …)` | **Remove** or no-op |

Cart add from book-room modal (if present): `POST` → `guestUrl("/bookings/cart/items")`.

### `public/js/cart.js`

| Current call | Replace with |
|--------------|--------------|
| `fetch("/api/auth/status", …)` | JWT/profile check |
| `fetch("/api/booking/cart", …)` GET | `GET /api/guest/bookings/cart` |
| `fetch("/api/booking/cart", …)` DELETE | `DELETE /api/guest/bookings/cart/items` |
| `fetch("/api/booking/checkout", …)` | `POST /api/guest/payments/order` |
| `fetch("/api/payment/verify", …)` | `POST /api/guest/payments/verify` |
| Redirect to `/api/auth/google` | PIN or Google guest-auth flow |

### CORS

Old app: same-origin, session cookies.

New app (if frontend on different origin):

- Set `API_BASE_URL` to the API host.
- Enable CORS with credentials **only if** the new backend uses cookies for guest JWT.
- If JWT is only in `Authorization` header, `credentials: "include"` is usually **not** required.

---

## Razorpay configuration (ops, not frontend JS)

| Old webhook URL | New webhook URL |
|-----------------|-----------------|
| `POST /api/payment/razorpay-webhook` | `POST /api/guest/payments/webhook` |
| `POST /api/payment/razorpay-event-webhook` or `/api/events/payment/razorpay-webhook` | `POST /api/guest/event-payments/webhook` |

Subscribe to: `payment.captured`, `payment.failed`, `order.paid` (same as before).

---

## Gap analysis

| Old guest capability | Status in new canonical API | Recommendation |
|----------------------|----------------------------|----------------|
| Session auth status poll | **No** `/api/auth/status` | Cache profile from `verify-pin` / `google`; optionally request target repo add `GET /api/guest-auth/me`. |
| Session logout | **No** logout route listed | Clear JWT client-side. |
| Google OAuth redirect flow | **Replaced** by `POST /api/guest-auth/google` | Use Google Identity Services; send token to API. |
| Chatbot | **Excluded** | Remove UI and requests. |
| Contact / inquiries | **No old endpoint** | Add form posting to `POST /api/inquiries` if needed. |
| `POST /api/booking/checkout` creates booking + order in one call | **Likely** `POST /api/guest/payments/order` | **Verify** whether a separate booking record is created before payment in target repo. |
| Cart DELETE by `{ roomId, checkIn, checkOut }` | **Verify** delete payload on `DELETE .../cart/items` | May need `itemId` from cart GET response. |
| Combined “my bookings” (rooms + events) | Two lists: `GET /api/guest/bookings` + `GET /api/guest/event-bookings` | Keep two fetches in `fillMyBookingsModal` (same as today). |
| Admin panel (`admin.js`) | **Out of scope** | Use manager/admin app on new backend separately. |

**Do not invent endpoints** beyond the canonical list; for gaps, extend the target backend or adjust UX (e.g. local-only logout).

---

## Quick reference: old → new path only

```
GET  /api/auth/google                          → POST /api/guest-auth/google
GET  /api/auth/status                          → (local JWT state)
POST /api/auth/logout                          → (clear JWT client-side)

GET  /api/booking/rooms                        → GET  /api/public/properties/:propertySlug/rooms
POST /api/booking/checkAvailability            → POST /api/public/properties/:propertySlug/quote
                                               → POST /api/guest/bookings/quote (authenticated)

GET  /api/booking/cart                         → GET    /api/guest/bookings/cart
POST /api/booking/cart                         → POST   /api/guest/bookings/cart/items
DELETE /api/booking/cart                       → DELETE /api/guest/bookings/cart/items
POST /api/booking/checkout                     → POST   /api/guest/payments/order
GET  /api/booking/bookings                     → GET    /api/guest/bookings

GET  /api/events                               → GET  /api/public/properties/:propertySlug/events
POST /api/booking/events/checkout              → POST /api/guest/event-bookings
POST /api/events/book                          → POST /api/guest/event-bookings
GET  /api/booking/events/bookings              → GET  /api/guest/event-bookings
GET  /api/events/bookings                      → GET  /api/guest/event-bookings

POST /api/payment/verify                       → POST /api/guest/payments/verify
POST /api/payment/verify-event                 → POST /api/guest/event-payments/verify
POST /api/payment/razorpay-webhook             → POST /api/guest/payments/webhook
POST /api/payment/razorpay-event-webhook       → POST /api/guest/event-payments/webhook

GET  /api/site-gallery                         → GET  /api/public/properties/:propertySlug/site-gallery

(none)                                         → POST /api/inquiries
(none)                                         → POST /api/guest-auth/request-pin
(none)                                         → POST /api/guest-auth/verify-pin
```

---

*Sources: [api-endpoints.md](./api-endpoints.md) (old), `public/js/main.js`, `public/js/cart.js`, canonical new routes from migration spec.*
