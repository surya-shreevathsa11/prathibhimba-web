(function () {
  "use strict";
  var POST_LOGIN_REDIRECT_KEY = "summer-green-post-login";

  var $ = function (sel) {
    return document.querySelector(sel);
  };
  var $$ = function (sel) {
    return document.querySelectorAll(sel);
  };

  var serverCart = [];
  var cartSummary = {
    totalPrice: 0,
    lowerPayableTotal: 0,
    upperPayableTotal: 0,
    lowerPercent: 0,
    upperPercent: 0,
  };
  var currentUser = null;

  // ─── API wiring (multi-property backend) ────────────────────────────────────
  var API_BASE_URL =
    (window.__PB_CONFIG__ && window.__PB_CONFIG__.API_BASE_URL) ||
    (window.__ENV__ && window.__ENV__.API_BASE_URL) ||
    (window.ENV && window.ENV.API_BASE_URL) ||
    "http://localhost:3000";
  var PROPERTY_SLUG =
    (window.__PB_CONFIG__ && window.__PB_CONFIG__.PROPERTY_SLUG) ||
    (window.__ENV__ && window.__ENV__.PROPERTY_SLUG) ||
    (window.ENV && window.ENV.PROPERTY_SLUG) ||
    "prathibhimba";
  var GOOGLE_CLIENT_ID =
    (window.__PB_CONFIG__ && window.__PB_CONFIG__.GOOGLE_CLIENT_ID) ||
    (window.__ENV__ && window.__ENV__.GOOGLE_CLIENT_ID) ||
    (window.ENV && window.ENV.GOOGLE_CLIENT_ID) ||
    "505975960167-kc4buclfdjmf74oq9nsmu2lfgmmfuddk.apps.googleusercontent.com";
  var GUEST_TOKEN_STORAGE_KEY = "guestAccessToken";
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
    } catch (_) { }
  }

  // Decode a JWT payload without verifying signature (display only).
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

  function guestApiPath(path) {
    return API_BASE_URL + "/api/guest" + path;
  }
  function apiFetch(url, opts) {
    var token = getGuestToken();
    var headers = Object.assign({}, (opts && opts.headers) || {});
    if (!headers["Content-Type"] && !(opts && opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) headers["Authorization"] = "Bearer " + token;
    return fetch(url, Object.assign({}, opts || {}, { headers: headers, credentials: "include" }));
  }

  function handleGsiCredential(response) {
    if (!response || !response.credential) return;
    fetch(API_BASE_URL + "/api/guest-auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        propertySlug: PROPERTY_SLUG,
        credential: response.credential,
      }),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        }).then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (r) {
        if (!r.ok || !r.data || r.data.success !== true || !r.data.token) {
          alert((r.data && r.data.message) || "Google sign-in failed.");
          return;
        }
        setGuestToken(r.data.token);
        fetchCart().then(function (result) {
          if (result && result.unauthorized) showSignInRequired();
          else renderCartList();
        });
      })
      .catch(function () {
        alert("Google sign-in failed. Please try again.");
      });
  }

  function initGoogleIdentity() {
    try {
      if (
        !window.google ||
        !window.google.accounts ||
        !window.google.accounts.id ||
        !GOOGLE_CLIENT_ID
      ) {
        return;
      }
      if (initGoogleIdentity._inited) return;
      initGoogleIdentity._inited = true;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGsiCredential,
        notification_callback: function (notification) {
          if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
            console.info("Google One Tap suppressed (cart page)");
          }
        },
      });
    } catch (_) { }
  }

  // Render the official Google Sign-In button into a container element.
  function renderSignInButton(container) {
    try {
      if (!container || !window.google || !window.google.accounts || !window.google.accounts.id) return;
      initGoogleIdentity();
      container.innerHTML = "";
      window.google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: container.offsetWidth || 280,
      });
    } catch (_) { }
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().slice(0, 10);
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatINR(amount) {
    var n = Number(amount);
    if (isNaN(n)) return "₹0";
    return "₹" + n.toLocaleString("en-IN");
  }

  function parseCartResponse(data) {
    var root =
      data && data.data && typeof data.data === "object" && !Array.isArray(data.data)
        ? data.data
        : data;
    if (!root || typeof root !== "object") root = {};
    var roomInfo = root.roomInfo;
    if (!Array.isArray(roomInfo)) {
      roomInfo =
        root.items ||
        (data && data.cart && data.cart.roomInfo) ||
        (Array.isArray(data && data.message) ? data.message : []);
    }
    if (!Array.isArray(roomInfo)) roomInfo = [];
    return {
      roomInfo: roomInfo,
      totalPrice: root.totalPrice != null ? root.totalPrice : 0,
      lowerPayableTotal: root.lowerPayableTotal != null ? root.lowerPayableTotal : 0,
      upperPayableTotal: root.upperPayableTotal != null ? root.upperPayableTotal : 0,
      lowerPercent: root.lowerPercent != null ? root.lowerPercent : 0,
      upperPercent: root.upperPercent != null ? root.upperPercent : 0,
    };
  }

  function showStep(stepId) {
    $$(".cart-step").forEach(function (el) {
      el.classList.add("cart-step--hidden");
    });
    var step = document.getElementById(stepId);
    if (step) step.classList.remove("cart-step--hidden");
  }

  function checkAuth(cb) {
    // No /me endpoint — infer from token; decode payload for real name/avatar.
    var t = getGuestToken();
    if (!t) {
      currentUser = null;
      if (cb) cb(null);
      return;
    }
    var payload = parseJwtPayload(t);
    currentUser = {
      name: (payload && (payload.name || payload.email)) || "Guest",
      picture: (payload && (payload.picture || payload.avatar)) || "",
      email: (payload && payload.email) || "",
    };
    if (cb) cb(currentUser);
  }

  function updateNavCartCount(count) {
    var el = $("#navCartCount");
    if (el) {
      el.textContent = count;
      el.setAttribute("data-count", count);
    }
  }

  function fetchCart() {
    return apiFetch(guestApiPath("/bookings/cart"))
      .then(function (res) {
        if (res.status === 401) return { unauthorized: true };
        return res.json().then(function (data) {
          var parsed = parseCartResponse(data);
          serverCart = parsed.roomInfo;
          cartSummary = {
            totalPrice: parsed.totalPrice,
            lowerPayableTotal: parsed.lowerPayableTotal,
            upperPayableTotal: parsed.upperPayableTotal,
            lowerPercent: parsed.lowerPercent,
            upperPercent: parsed.upperPercent,
          };
          return { ok: res.ok, unauthorized: res.status === 401 };
        });
      })
      .catch(function () {
        serverCart = [];
        cartSummary = {
          totalPrice: 0,
          lowerPayableTotal: 0,
          upperPayableTotal: 0,
          lowerPercent: 0,
          upperPercent: 0,
        };
        return { ok: false };
      });
  }

  function renderPrepaidOptionsHtml(room) {
    if (!room.prepaidOptions || !room.prepaidOptions.length) return "";
    var rows = room.prepaidOptions
      .map(function (opt) {
        var label = escapeHtml(opt.label || opt.id || "Option");
        var pct = opt.percent != null ? opt.percent + "%" : "";
        var amt = opt.prepaidAmount != null ? formatINR(opt.prepaidAmount) : "";
        var refund =
          opt.refundAvailable === true
            ? "Refundable"
            : opt.refundAvailable === false
              ? "Non-refundable"
              : "";
        var primary = opt.isPrimary ? " · Primary" : "";
        return (
          '<li class="cart__item-prepaid__option">' +
          "<span>" +
          label +
          (pct ? " (" + pct + ")" : "") +
          primary +
          "</span>" +
          "<span>" +
          amt +
          (refund ? ' <em class="cart__item-prepaid__refund">' + refund + "</em>" : "") +
          "</span>" +
          "</li>"
        );
      })
      .join("");
    var range =
      room.lowerPrepaidAmount != null && room.upperPrepaidAmount != null
        ? '<p class="cart__item-prepaid__range">Pay ' +
          formatINR(room.lowerPrepaidAmount) +
          " – " +
          formatINR(room.upperPrepaidAmount) +
          " upfront</p>"
        : "";
    return (
      '<div class="cart__item-prepaid">' +
      '<p class="cart__item-prepaid__title">Payment options</p>' +
      range +
      '<ul class="cart__item-prepaid__list">' +
      rows +
      "</ul></div>"
    );
  }

  function renderCartList() {
    var listEl = $("#cartList");
    var emptyEl = $("#cartEmpty");
    var footerEl = $("#cartFooter");
    var totalEl = $("#cartTotal");
    var payableEl = $("#cartPayable");
    if (!listEl) return;
    listEl.innerHTML = "";
    if (serverCart.length === 0) {
      if (emptyEl) emptyEl.style.display = "block";
      if (footerEl) footerEl.style.display = "none";
      updateNavCartCount(0);
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";
    if (footerEl) footerEl.style.display = "block";
    serverCart.forEach(function (room) {
      var price = room.price || 0;
      var checkInIso = formatDate(room.checkIn);
      var checkOutIso = formatDate(room.checkOut);
      var checkInLabel = formatDateDisplay(room.checkIn);
      var checkOutLabel = formatDateDisplay(room.checkOut);
      var adults = room.adults != null ? room.adults : 1;
      var children =
        room.children != null && typeof room.children === "number"
          ? room.children
          : 0;
      var roomName = room.roomName || room.roomId || "Room";
      var roomType = room.type ? escapeHtml(room.type) : "";
      var breakdownHtml = "";
      if (room.priceBreakdown && Array.isArray(room.priceBreakdown) && room.priceBreakdown.length > 0) {
        breakdownHtml =
          '<div class="cart__item-breakdown">' +
          '<p class="cart__item-breakdown__title">Nightly breakdown</p>' +
          room.priceBreakdown
            .map(function (row) {
              var d = row.date != null ? formatDateDisplay(row.date) : "";
              var p = row.price != null ? formatINR(row.price) : formatINR(0);
              var r = row.reason ? escapeHtml(row.reason) : "";
              return (
                '<div class="cart__item-breakdown__row">' +
                (d ? escapeHtml(d) + " — " : "") +
                p +
                (r ? " (" + r + ")" : "") +
                "</div>"
              );
            })
            .join("") +
          "</div>";
      }
      var prepaidHtml = renderPrepaidOptionsHtml(room);
      var item = document.createElement("div");
      item.className = "cart__item";
      item.innerHTML =
        '<div class="cart__item-info">' +
        '<div class="cart__item-name">' +
        escapeHtml(roomName) +
        (roomType ? ' <span class="cart__item-type">(' + roomType + ")</span>" : "") +
        "</div>" +
        '<div class="cart__item-meta">' +
        escapeHtml(checkInLabel) +
        " – " +
        escapeHtml(checkOutLabel) +
        " · " +
        adults +
        " adult(s)" +
        (children ? ", " + children + " kid(s)" : "") +
        "</div>" +
        '<div class="cart__item-price">' +
        formatINR(price) +
        " total</div>" +
        breakdownHtml +
        prepaidHtml +
        "</div>" +
        '<button type="button" class="cart__item-remove cursor-target" data-remove data-room-id="' +
        escapeHtml(room.roomId || "") +
        '" data-check-in="' +
        escapeHtml(checkInIso) +
        '" data-check-out="' +
        escapeHtml(checkOutIso) +
        '">Remove</button>';
      listEl.appendChild(item);
    });
    listEl.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var roomId = btn.getAttribute("data-room-id");
        var checkIn = btn.getAttribute("data-check-in");
        var checkOut = btn.getAttribute("data-check-out");
        removeFromCart(roomId, checkIn, checkOut);
      });
    });
    var displayTotal =
      cartSummary.totalPrice > 0
        ? cartSummary.totalPrice
        : serverCart.reduce(function (sum, r) {
            return sum + (r.price || 0);
          }, 0);
    if (totalEl) totalEl.textContent = formatINR(displayTotal);
    if (payableEl) {
      if (
        cartSummary.lowerPayableTotal > 0 ||
        cartSummary.upperPayableTotal > 0
      ) {
        payableEl.style.display = "block";
        payableEl.innerHTML =
          "Pay now: <strong>" +
          formatINR(cartSummary.lowerPayableTotal) +
          "</strong>" +
          (cartSummary.lowerPercent != null
            ? " (" + cartSummary.lowerPercent + "%)"
            : "") +
          " – <strong>" +
          formatINR(cartSummary.upperPayableTotal) +
          "</strong>" +
          (cartSummary.upperPercent != null
            ? " (" + cartSummary.upperPercent + "%)"
            : "");
      } else {
        payableEl.style.display = "none";
        payableEl.textContent = "";
      }
    }
    updateNavCartCount(serverCart.length);
  }

  function removeFromCart(roomId, checkIn, checkOut) {
    apiFetch(guestApiPath("/bookings/cart/items"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: roomId,
        checkIn: checkIn,
        checkOut: checkOut,
      }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function () {
        return fetchCart().then(function () {
          renderCartList();
        });
      })
      .catch(function () {
        fetchCart().then(renderCartList);
      });
  }

  function onProceedToCheckout() {
    showStep("stepCheckout");
  }

  function openTermsModal() {
    var modal = $("#termsModal");
    if (modal) modal.classList.add("active");
    var cb = $("#termsAccept");
    var btn = $("#termsProceedBtn");
    if (cb) cb.checked = false;
    if (btn) btn.disabled = true;
  }

  function closeTermsModal() {
    var modal = $("#termsModal");
    if (modal) modal.classList.remove("active");
  }

  function showSignInRequired() {
    var listEl = $("#cartList");
    var emptyEl = $("#cartEmpty");
    var footerEl = $("#cartFooter");
    if (listEl) listEl.innerHTML = "";
    if (footerEl) footerEl.style.display = "none";
    if (emptyEl) {
      emptyEl.style.display = "block";
      emptyEl.innerHTML =
        "Please sign in to view your cart and proceed with booking." +
        '<div id="cartSignInContainer" style="display:flex;justify-content:center;margin-top:1rem;min-height:44px;align-items:center;">' +
        '<span style="opacity:0.45;font-size:0.85rem;">Loading Google sign-in\u2026</span>' +
        "</div>";
      var container = document.getElementById("cartSignInContainer");
      if (container) {
        try {
          sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, "cart");
        } catch (_) { }
        // If GSI is already ready, render immediately; otherwise it will be rendered by tryEagerGsiInit
        renderSignInButton(container);
      }
    }
    updateNavCartCount(0);
  }

  function init() {
    var navToggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");
    if (navToggle && navLinks) {
      navToggle.addEventListener("click", function () {
        navLinks.classList.toggle("open");
      });
    }

    // Eagerly initialise GSI so the "Sign In" button on this page works
    // even when the user lands here directly (async script may already be ready).
    function tryEagerGsiInit() {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        initGoogleIdentity();
        // If the sign-in container is already in the DOM (rendered by showSignInRequired),
        // inject the Google button into it now.
        var container = document.getElementById("cartSignInContainer");
        if (container) renderSignInButton(container);
      }
    }
    tryEagerGsiInit();
    window.addEventListener("load", tryEagerGsiInit);
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(tryEagerGsiInit, { timeout: 3000 });
    }

    $("#cartList").innerHTML = "";
    fetchCart().then(function (result) {
      if (result.unauthorized) {
        serverCart = [];
        showSignInRequired();
        return;
      }
      renderCartList();
      try {
        if (sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) === "cart") {
          sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
          if (serverCart.length > 0) showStep("stepCheckout");
        }
      } catch (_) { }
    });

    var cartCheckoutBtn = $("#cartCheckoutBtn");
    if (cartCheckoutBtn) {
      cartCheckoutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        onProceedToCheckout();
      });
    }

    var checkoutForm = $("#checkoutForm");
    if (checkoutForm) {
      checkoutForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = $("#checkoutName").value.trim();
        var email = $("#checkoutEmail").value.trim();
        var phone = $("#checkoutPhone").value.trim();
        var errEl = $("#checkoutError");
        errEl.textContent = "";
        if (!name || !email || !phone) {
          errEl.textContent = "Please fill in name, email and phone.";
          return;
        }
        openTermsModal();
      });
    }

    var termsAccept = $("#termsAccept");
    var termsProceedBtn = $("#termsProceedBtn");
    if (termsAccept && termsProceedBtn) {
      termsAccept.addEventListener("change", function () {
        termsProceedBtn.disabled = !termsAccept.checked;
      });
    }

    if (termsProceedBtn) {
      termsProceedBtn.addEventListener("click", function () {
        if (!termsAccept || !termsAccept.checked) return;

        var name = $("#checkoutName").value.trim();
        var email = $("#checkoutEmail").value.trim();
        var phone = $("#checkoutPhone").value.trim();

        termsProceedBtn.disabled = true;

        var rooms = serverCart.map(function (r) {
          return {
            roomId: r.roomId,
            checkIn: formatDate(r.checkIn),
            checkOut: formatDate(r.checkOut),
            adults: r.adults != null ? r.adults : 1,
            children: r.children != null ? r.children : 0,
          };
        });

        apiFetch(guestApiPath("/payments/order"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name,
            email: email,
            phone: phone,
            rooms: rooms,
          }),
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { status: res.status, data: data };
            });
          })
          .then(function (result) {
            if (
              result.status === 201 &&
              result.data &&
              result.data.data &&
              (result.data.data.razorpayOrderId || result.data.data.orderId) &&
              (result.data.data.key || result.data.data.razorpayKeyId)
            ) {
              closeTermsModal();

              if (!window.Razorpay) {
                alert(
                  "Razorpay checkout script not loaded. Please refresh the page and try again."
                );
                termsProceedBtn.disabled = false;
                return;
              }

              var bookingData = result.data.data;
              var orderId = bookingData.razorpayOrderId || bookingData.orderId;
              var keyId = bookingData.key || bookingData.razorpayKeyId;

              var options = {
                key: keyId,
                amount: bookingData.totalAmount * 100, // paise
                currency: "INR",
                order_id: orderId,
                name: "Summer Green",
                description: "Room Booking",
                prefill: {
                  name: name,
                  email: email,
                  contact: phone,
                },

                // ✅ Called by Razorpay on successful payment
                handler: function (response) {
                  // Verify payment signature on backend before redirecting
                  apiFetch(guestApiPath("/payments/verify"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                    }),
                  })
                    .then(function (res) {
                      return res.json();
                    })
                    .then(function (data) {
                      if (data.success) {
                        // Clear cart then redirect to success page
                        window.location.href = "/?payment=success";
                      } else {
                        alert(
                          "Payment verification failed. Please contact support with your payment ID: " +
                          response.razorpay_payment_id
                        );
                        termsProceedBtn.disabled = false;
                      }
                    })
                    .catch(function () {
                      alert(
                        "Could not verify payment. Please contact support with your payment ID: " +
                        response.razorpay_payment_id
                      );
                      termsProceedBtn.disabled = false;
                    });
                },

                modal: {
                  // User closed modal without paying — re-enable button
                  ondismiss: function () {
                    termsProceedBtn.disabled = false;
                  },
                },
              };

              var rzp = new window.Razorpay(options);

              // Handle payment failure inside the modal (e.g. wrong card)
              rzp.on("payment.failed", function (response) {
                console.error("Payment failed:", response.error);
                alert(
                  "Payment failed: " +
                  (response.error.description || "Please try again.")
                );
                termsProceedBtn.disabled = false;
              });

              rzp.open();
            } else {
              alert(
                result.data.message ||
                "Could not create payment order. Please try again."
              );
              termsProceedBtn.disabled = false;
            }
          })
          .catch(function () {
            alert("Something went wrong. Please try again.");
            termsProceedBtn.disabled = false;
          });
      });
    }

    $$("[data-close-terms]").forEach(function (el) {
      el.addEventListener("click", closeTermsModal);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
