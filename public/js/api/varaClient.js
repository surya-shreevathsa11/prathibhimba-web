/**
 * Centralized Vara API client for the Prathibhimba guest frontend.
 * All guest/public HTTP calls should go through window.VaraApi — do not
 * scatter raw fetch() to Vara endpoints from page scripts.
 *
 * Config: window.__PB_CONFIG__ (see /js/app-config.js)
 * Auth: localStorage key "guestAccessToken" → Authorization: Bearer <token>
 */
(function (global) {
  "use strict";

  var GUEST_TOKEN_STORAGE_KEY = "guestAccessToken";
  var AUTH_REQUIRED_EVENT = "vara:auth-required";

  function readConfig() {
    var cfg = global.__PB_CONFIG__ || global.__ENV__ || global.ENV || {};
    return {
      API_BASE_URL: String(cfg.API_BASE_URL || "https://api.varalabs.in").replace(
        /\/$/,
        ""
      ),
      PROPERTY_SLUG: cfg.PROPERTY_SLUG || "prathibhimba",
      GOOGLE_CLIENT_ID: cfg.GOOGLE_CLIENT_ID || "",
    };
  }

  function getConfig() {
    return readConfig();
  }

  // ─── Token storage ──────────────────────────────────────────────────────────

  function getGuestToken() {
    try {
      return localStorage.getItem(GUEST_TOKEN_STORAGE_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function setGuestToken(token) {
    try {
      if (!token) localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
      else localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, String(token));
    } catch (_) {}
  }

  function clearGuestToken() {
    setGuestToken("");
  }

  function parseJwtPayload(token) {
    try {
      var parts = String(token).split(".");
      if (parts.length < 2) return null;
      var b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      var json = decodeURIComponent(
        atob(b64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(json);
    } catch (_) {
      return null;
    }
  }

  function guestProfileFromToken(token) {
    var payload = parseJwtPayload(token || getGuestToken());
    if (!payload) return null;
    return {
      name: payload.name || payload.email || "Guest",
      picture: payload.picture || payload.avatar || "",
      email: payload.email || "",
      sub: payload.sub || "",
      propertyId: payload.propertyId || "",
      propertySlug: payload.propertySlug || "",
    };
  }

  // ─── URL builders ───────────────────────────────────────────────────────────

  function publicUrl(path) {
    var cfg = readConfig();
    var p = path.charAt(0) === "/" ? path : "/" + path;
    return (
      cfg.API_BASE_URL +
      "/api/public/properties/" +
      encodeURIComponent(cfg.PROPERTY_SLUG) +
      p
    );
  }

  function guestUrl(path) {
    var cfg = readConfig();
    var p = path.charAt(0) === "/" ? path : "/" + path;
    return cfg.API_BASE_URL + "/api/guest" + p;
  }

  function guestAuthUrl(path) {
    var cfg = readConfig();
    var p = path.charAt(0) === "/" ? path : "/" + path;
    return cfg.API_BASE_URL + "/api/guest-auth" + p;
  }

  // ─── Core fetch ─────────────────────────────────────────────────────────────

  function ApiError(message, status, body) {
    var err = new Error(message || "Request failed");
    err.name = "ApiError";
    err.status = status || 0;
    err.body = body || null;
    return err;
  }

  function notifyAuthRequired(status) {
    try {
      global.dispatchEvent(
        new CustomEvent(AUTH_REQUIRED_EVENT, {
          detail: { status: status || 401 },
        })
      );
    } catch (_) {}
  }

  /**
   * Low-level fetch. Returns { ok, status, data, headers }.
   * Does not throw on HTTP errors — callers decide.
   */
  function request(url, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    var hasBody = opts.body != null;
    var isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;

    if (hasBody && !isForm && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (opts.auth !== false) {
      var token = getGuestToken();
      if (token) headers["Authorization"] = "Bearer " + token;
    }

    var body = opts.body;
    if (
      body != null &&
      typeof body === "object" &&
      !isForm &&
      typeof body !== "string"
    ) {
      body = JSON.stringify(body);
    }

    return fetch(url, {
      method: opts.method || "GET",
      headers: headers,
      body: body,
      // JWT is in Authorization; cookies are not required for Vara guest APIs.
      credentials: opts.credentials || "omit",
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if ((res.status === 401 || res.status === 403) && opts.auth !== false) {
            if (res.status === 401) {
              clearGuestToken();
              notifyAuthRequired(401);
            } else if (opts.notifyForbidden !== false) {
              notifyAuthRequired(403);
            }
          }
          return {
            ok: res.ok,
            status: res.status,
            data: data,
            headers: res.headers,
          };
        });
    });
  }

  /** Throws ApiError when !ok. */
  function requestOrThrow(url, opts) {
    return request(url, opts).then(function (r) {
      if (!r.ok) {
        var msg =
          (r.data && (r.data.message || r.data.error)) ||
          "Request failed (" + r.status + ")";
        throw ApiError(msg, r.status, r.data);
      }
      return r;
    });
  }

  // ─── Response adapters (normalize Vara shapes for UI) ───────────────────────

  function unwrapData(payload) {
    if (!payload || typeof payload !== "object") return payload;
    if (payload.data !== undefined) return payload.data;
    return payload;
  }

  function adaptRooms(payload) {
    var root = unwrapData(payload);
    var rooms =
      (payload && payload.rooms) ||
      (root && root.rooms) ||
      (Array.isArray(root) ? root : []) ||
      [];
    if (!Array.isArray(rooms)) rooms = [];
    return rooms.map(function (r) {
      return {
        id: r.id != null ? r.id : r.roomId,
        roomId: r.roomId || (r.id != null ? "R" + r.id : ""),
        name: r.name || "",
        description: r.description || "",
        type: r.type || "",
        price:
          r.price != null
            ? r.price
            : r.pricePerNight != null
              ? r.pricePerNight
              : 0,
        pricePerNight:
          r.pricePerNight != null
            ? r.pricePerNight
            : r.price != null
              ? r.price
              : 0,
        capacity: r.capacity || null,
        images: r.images || {},
        raw: r,
      };
    });
  }

  function adaptEvents(payload) {
    var root = unwrapData(payload);
    var events =
      (payload && payload.events) ||
      (Array.isArray(root) ? root : root && root.events) ||
      [];
    if (!Array.isArray(events)) events = [];
    return events.map(function (ev) {
      return {
        id: ev._id || ev.id,
        name: ev.name || ev.title || "Event",
        description: ev.description || "",
        startDate: ev.startDate || null,
        endDate: ev.endDate || null,
        pricePerPerson:
          ev.pricePerPerson != null ? Number(ev.pricePerPerson) : 0,
        maxPeopleAllowed: ev.maxPeopleAllowed,
        curPeopleEnrolled: ev.curPeopleEnrolled,
        banner: ev.banner || (ev.images && ev.images.banner) || "",
        gallery: ev.gallery || (ev.images && ev.images.gallery) || [],
        brochure: ev.brochure || "",
        raw: ev,
      };
    });
  }

  function adaptQuote(payload) {
    var root = unwrapData(payload) || {};
    return {
      available: root.available !== false && payload && payload.success !== false,
      totalPrice:
        root.totalPrice != null
          ? root.totalPrice
          : root.price != null
            ? root.price
            : null,
      priceBreakdown: root.priceBreakdown || root.breakdown || [],
      message: (payload && payload.message) || root.message || "",
      raw: root,
    };
  }

  function adaptCart(payload) {
    var root =
      payload &&
      payload.data &&
      typeof payload.data === "object" &&
      !Array.isArray(payload.data)
        ? payload.data
        : payload;
    if (!root || typeof root !== "object") root = {};
    var roomInfo = root.roomInfo;
    if (!Array.isArray(roomInfo)) {
      roomInfo =
        root.items ||
        (payload && payload.cart && payload.cart.roomInfo) ||
        (Array.isArray(payload && payload.message) ? payload.message : []);
    }
    if (!Array.isArray(roomInfo)) roomInfo = [];
    return {
      roomInfo: roomInfo,
      items: roomInfo,
      totalPrice: root.totalPrice != null ? root.totalPrice : 0,
      lowerPayableTotal: root.lowerPayableTotal != null ? root.lowerPayableTotal : 0,
      upperPayableTotal: root.upperPayableTotal != null ? root.upperPayableTotal : 0,
      lowerPercent: root.lowerPercent != null ? root.lowerPercent : 0,
      upperPercent: root.upperPercent != null ? root.upperPercent : 0,
      raw: root,
    };
  }

  function adaptBookings(payload) {
    var root = unwrapData(payload);
    var list =
      (Array.isArray(root) && root) ||
      (root && root.bookings) ||
      (payload && payload.bookings) ||
      [];
    return Array.isArray(list) ? list : [];
  }

  function adaptPaymentOrder(payload) {
    var root = unwrapData(payload) || {};
    return {
      razorpayOrderId: root.razorpayOrderId || root.orderId || "",
      key: root.key || root.razorpayKeyId || "",
      totalAmount: root.totalAmount != null ? Number(root.totalAmount) : 0,
      bookingId: root.bookingId || root.id || "",
      rooms: root.rooms || [],
      raw: root,
    };
  }

  /**
   * Event booking create response:
   * - Free: confirmed immediately (no razorpayOrderId)
   * - Paid: pending + razorpayOrderId + key
   */
  function adaptEventBookingCreate(payload) {
    var root = unwrapData(payload) || {};
    var orderId = root.razorpayOrderId || root.orderId || "";
    var key = root.key || root.razorpayKeyId || "";
    var totalAmount =
      root.totalAmount != null
        ? Number(root.totalAmount)
        : root.amount != null
          ? Number(root.amount)
          : 0;
    var status = String(root.status || "").toLowerCase();
    var needsPayment = !!(orderId && key);
    var confirmed =
      !needsPayment &&
      (status === "confirmed" ||
        status === "booked" ||
        payload.success === true ||
        totalAmount === 0);
    return {
      needsPayment: needsPayment,
      confirmed: confirmed || (!needsPayment && !orderId),
      razorpayOrderId: orderId,
      key: key,
      totalAmount: totalAmount,
      bookingId: root.bookingId || root.id || root._id || "",
      status: root.status || (confirmed ? "confirmed" : "pending"),
      message: (payload && payload.message) || root.message || "",
      raw: root,
    };
  }

  function adaptSiteGallery(payload) {
    var root = unwrapData(payload);
    var images =
      (payload && payload.images) ||
      (root && root.images) ||
      (Array.isArray(root) ? root : []) ||
      [];
    return Array.isArray(images) ? images : [];
  }

  // ─── Public API methods ─────────────────────────────────────────────────────

  var publicApi = {
    getRooms: function () {
      return request(publicUrl("/rooms"), { auth: false }).then(function (r) {
        return {
          ok: r.ok,
          status: r.status,
          rooms: r.ok ? adaptRooms(r.data) : [],
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    getEvents: function () {
      return request(publicUrl("/events"), { auth: false }).then(function (r) {
        return {
          ok: r.ok,
          status: r.status,
          events: r.ok ? adaptEvents(r.data) : [],
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    quote: function (body) {
      return request(publicUrl("/quote"), {
        method: "POST",
        auth: false,
        body: body,
      }).then(function (r) {
        return {
          ok: r.ok,
          status: r.status,
          quote: adaptQuote(r.data),
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    getSiteGallery: function () {
      return request(publicUrl("/site-gallery"), { auth: false }).then(
        function (r) {
          return {
            ok: r.ok,
            status: r.status,
            images: r.ok ? adaptSiteGallery(r.data) : [],
            message: (r.data && r.data.message) || "",
            raw: r.data,
          };
        }
      );
    },
  };

  // ─── Guest auth ─────────────────────────────────────────────────────────────

  var guestAuth = {
    requestPin: function (body) {
      return request(guestAuthUrl("/request-pin"), {
        method: "POST",
        auth: false,
        body: body,
      });
    },

    verifyPin: function (body) {
      return request(guestAuthUrl("/verify-pin"), {
        method: "POST",
        auth: false,
        body: body,
      }).then(function (r) {
        if (r.ok && r.data && r.data.token) {
          setGuestToken(r.data.token);
        }
        return {
          ok: r.ok,
          status: r.status,
          token: (r.data && r.data.token) || "",
          guest: (r.data && r.data.guest) || guestProfileFromToken(r.data && r.data.token),
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    google: function (credential) {
      var cfg = readConfig();
      return request(guestAuthUrl("/google"), {
        method: "POST",
        auth: false,
        body: {
          propertySlug: cfg.PROPERTY_SLUG,
          credential: credential,
        },
      }).then(function (r) {
        var success =
          r.ok && r.data && r.data.success !== false && r.data.token;
        if (success) setGuestToken(r.data.token);
        return {
          ok: !!success,
          status: r.status,
          token: (r.data && r.data.token) || "",
          guest:
            (r.data && r.data.guest) ||
            guestProfileFromToken(r.data && r.data.token) ||
            null,
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    logout: function () {
      clearGuestToken();
    },
  };

  // ─── Guest room bookings / cart ─────────────────────────────────────────────

  var guestBookings = {
    quote: function (body) {
      return request(guestUrl("/bookings/quote"), {
        method: "POST",
        body: body,
      }).then(function (r) {
        return {
          ok: r.ok,
          status: r.status,
          quote: adaptQuote(r.data),
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    getRooms: function () {
      return request(guestUrl("/bookings/rooms")).then(function (r) {
        return {
          ok: r.ok,
          status: r.status,
          rooms: r.ok ? adaptRooms(r.data) : [],
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    getCart: function () {
      return request(guestUrl("/bookings/cart")).then(function (r) {
        return {
          ok: r.ok,
          status: r.status,
          unauthorized: r.status === 401,
          cart: r.ok ? adaptCart(r.data) : adaptCart({}),
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    addCartItem: function (body) {
      return request(guestUrl("/bookings/cart/items"), {
        method: "POST",
        body: body,
      }).then(function (r) {
        return {
          ok: r.ok,
          status: r.status,
          cart: r.ok ? adaptCart(r.data) : null,
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    removeCartItem: function (body) {
      return request(guestUrl("/bookings/cart/items"), {
        method: "DELETE",
        body: body,
      }).then(function (r) {
        return {
          ok: r.ok,
          status: r.status,
          cart: r.ok ? adaptCart(r.data) : null,
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    listBookings: function () {
      return request(guestUrl("/bookings")).then(function (r) {
        return {
          ok: r.ok,
          status: r.status,
          bookings: r.ok ? adaptBookings(r.data) : [],
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },
  };

  // ─── Guest room payments ────────────────────────────────────────────────────

  var guestPayments = {
    createOrder: function (body) {
      return request(guestUrl("/payments/order"), {
        method: "POST",
        body: body,
      }).then(function (r) {
        var order = adaptPaymentOrder(r.data);
        return {
          ok: r.ok && r.status === 201 && order.razorpayOrderId && order.key,
          status: r.status,
          order: order,
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    verify: function (body) {
      return request(guestUrl("/payments/verify"), {
        method: "POST",
        body: body,
      }).then(function (r) {
        return {
          ok: r.ok && r.data && r.data.success !== false,
          status: r.status,
          booking: (r.data && r.data.booking) || null,
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },
  };

  // ─── Guest event bookings / payments ────────────────────────────────────────

  var guestEvents = {
    listBookings: function () {
      return request(guestUrl("/event-bookings")).then(function (r) {
        return {
          ok: r.ok,
          status: r.status,
          bookings: r.ok ? adaptBookings(r.data) : [],
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },

    /**
     * Create event booking.
     * Body: { eventId, guest: { name, email, phone, guestCount } }
     * guestCount must be 1 or 2.
     * Free events confirm immediately; paid return Razorpay order fields.
     */
    createBooking: function (body) {
      return request(guestUrl("/event-bookings"), {
        method: "POST",
        body: body,
        // 403 when eventsEnabled is false — surface message, don't treat as auth.
        notifyForbidden: false,
      }).then(function (r) {
        var booking = adaptEventBookingCreate(r.data);
        var ok =
          r.ok &&
          (r.status === 200 || r.status === 201) &&
          (booking.needsPayment || booking.confirmed);
        return {
          ok: ok,
          status: r.status,
          booking: booking,
          message: (r.data && r.data.message) || booking.message || "",
          raw: r.data,
        };
      });
    },

    verifyPayment: function (body) {
      return request(guestUrl("/event-payments/verify"), {
        method: "POST",
        body: body,
      }).then(function (r) {
        return {
          ok: r.ok && r.data && r.data.success !== false,
          status: r.status,
          booking: (r.data && r.data.booking) || null,
          message: (r.data && r.data.message) || "",
          raw: r.data,
        };
      });
    },
  };

  // ─── Public surface ─────────────────────────────────────────────────────────

  global.VaraApi = {
    AUTH_REQUIRED_EVENT: AUTH_REQUIRED_EVENT,
    GUEST_TOKEN_STORAGE_KEY: GUEST_TOKEN_STORAGE_KEY,
    getConfig: getConfig,
    getGuestToken: getGuestToken,
    setGuestToken: setGuestToken,
    clearGuestToken: clearGuestToken,
    parseJwtPayload: parseJwtPayload,
    guestProfileFromToken: guestProfileFromToken,
    publicUrl: publicUrl,
    guestUrl: guestUrl,
    guestAuthUrl: guestAuthUrl,
    request: request,
    requestOrThrow: requestOrThrow,
    adapters: {
      rooms: adaptRooms,
      events: adaptEvents,
      quote: adaptQuote,
      cart: adaptCart,
      bookings: adaptBookings,
      paymentOrder: adaptPaymentOrder,
      eventBookingCreate: adaptEventBookingCreate,
      siteGallery: adaptSiteGallery,
    },
    public: publicApi,
    auth: guestAuth,
    bookings: guestBookings,
    payments: guestPayments,
    events: guestEvents,
  };
})(typeof window !== "undefined" ? window : globalThis);
