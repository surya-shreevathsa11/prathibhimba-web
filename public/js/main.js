(function () {
  let currentUser = null;
  /** Set by setupChatbotWidget; called from updateAuthUI when auth changes */
  var refreshChatbotAuthUI = null;
  /** Room limit: set from backend after validating /api/booking/rooms response. Only these room IDs are allowed for cart/booking. */
  let validRoomIdsFromBackend = [];
  /** Per-room guest limits from GET /api/booking/rooms (capacity synced from config/room.js). Key: roomId e.g. "R1". */
  let roomsCapacityByRoomId = {};

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── API wiring via centralized Vara client (public/js/api/varaClient.js) ────
  var Vara = window.VaraApi;
  if (!Vara) {
    console.error("VaraApi missing — load /js/api/varaClient.js before main.js");
  }
  var cfg = (Vara && Vara.getConfig()) || {};
  var GOOGLE_CLIENT_ID = cfg.GOOGLE_CLIENT_ID || "";

  function getGuestToken() {
    return (Vara && Vara.getGuestToken()) || "";
  }
  function clearGuestToken() {
    if (Vara) Vara.clearGuestToken();
  }
  function setGuestToken(token) {
    if (Vara) Vara.setGuestToken(token);
  }
  function parseJwtPayload(token) {
    return (Vara && Vara.parseJwtPayload(token)) || null;
  }

  // ─── Guest Google sign-in (Google Identity Services) ────────────────────────
  function handleGsiCredential(response) {
    if (!response || !response.credential || !Vara) return;
    Vara.auth
      .google(response.credential)
      .then(function (r) {
        if (!r.ok) {
          var errEl = $("#signInError");
          if (errEl)
            errEl.textContent = r.message || "Google sign-in failed.";
          return;
        }
        currentUser = r.guest || { name: "Guest" };
        updateAuthUI();
        fetchCartCount();
        closeAllModals();
      })
      .catch(function (err) {
        console.error("Google sign-in error:", err);
        var errEl = $("#signInError");
        if (errEl) errEl.textContent = "Google sign-in failed. Please try again.";
      });
  }

  // 401 from protected routes → clear session UI and open sign-in
  window.addEventListener(Vara ? Vara.AUTH_REQUIRED_EVENT : "vara:auth-required", function (ev) {
    if (ev && ev.detail && ev.detail.status === 403) return;
    currentUser = null;
    updateAuthUI();
    var countEl = $("#navCartCount");
    if (countEl) {
      countEl.textContent = "0";
      countEl.setAttribute("data-count", "0");
    }
  });

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
        // Catch One Tap suppression so we don't silently fail
        notification_callback: function (notification) {
          if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
            // One Tap was suppressed — the renderButton flow is already visible, nothing else to do
            console.info("Google One Tap suppressed:", notification.getSkippedReason && notification.getSkippedReason());
          }
        },
      });
    } catch (_) { }
  }

  // Render the official Google Sign-In button into #googleSignInContainer.
  // This uses the popup/redirect flow which is NOT subject to One Tap suppression.
  function renderSignInButton() {
    try {
      var container = $("#googleSignInContainer");
      if (!container || !window.google || !window.google.accounts || !window.google.accounts.id) return;
      initGoogleIdentity();
      // Clear and re-render (safe to call multiple times)
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

  // --- Nav scroll + contrast by section (cream vs dark green) ---
  var navEl = $("#nav");
  if (navEl) {
    window.addEventListener(
      "scroll",
      () => {
        navEl.classList.toggle("scrolled", window.scrollY > 60);
      },
      { passive: true }
    );

    var sections = $$("section[data-nav-theme]");
    var heroEl = $(".hero");
    function updateNavTheme() {
      if (!navEl.classList.contains("scrolled")) {
        navEl.classList.remove("nav--over-dark", "nav--over-light");
        return;
      }
      var viewportMid = window.scrollY + window.innerHeight * 0.4;
      var current = null;
      var currentTop = -1;
      if (heroEl && window.scrollY < heroEl.offsetHeight * 0.8) {
        navEl.classList.remove("nav--over-light");
        navEl.classList.add("nav--over-dark");
        return;
      }
      sections.forEach(function (sec) {
        var top = sec.offsetTop;
        var bottom = top + sec.offsetHeight;
        if (viewportMid >= top && viewportMid <= bottom && top > currentTop) {
          current = sec;
          currentTop = top;
        }
      });
      navEl.classList.remove("nav--over-dark", "nav--over-light");
      if (current && current.getAttribute("data-nav-theme") === "light") {
        navEl.classList.add("nav--over-light");
      } else {
        navEl.classList.add("nav--over-dark");
      }
    }
    window.addEventListener("scroll", updateNavTheme, { passive: true });
    window.addEventListener("resize", updateNavTheme);
    updateNavTheme();
  }

  // --- Mobile nav toggle ---
  var navToggle = $("#navToggle");
  if (navToggle) {
    navToggle.addEventListener("click", () => {
      var links = $("#navLinks");
      if (links) links.classList.toggle("open");
    });
  }

  // --- Smooth scroll for nav links (Rooms and other # anchors scroll to section; page stays scrollable) ---
  function scrollToSection(selector, offset) {
    var el = typeof selector === "string" ? $(selector) : selector;
    if (!el) return;
    var lenis = typeof window.getLenis === "function" ? window.getLenis() : null;
    if (lenis && typeof lenis.scrollTo === "function") {
      lenis.scrollTo(el, { offset: offset != null ? offset : -80, duration: 1.2 });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  $$(
    ".nav__links a, .hero .btn, .footer__links a, .section__actions a",
  ).forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href === "#rooms") {
        e.preventDefault();
        scrollToSection("#rooms", -80);
        var navLinks = $("#navLinks");
        if (navLinks) navLinks.classList.remove("open");
        return;
      }
      if (href && href.startsWith("#")) {
        e.preventDefault();
        const target = $(href);
        if (target) scrollToSection(target, -80);
        $("#navLinks").classList.remove("open");
      }
    });
  });

  // --- Add to cart: open book popup; backend validates session and returns message if not signed in ---
  function onAddToCartClick(id, name, price) {
    openBookRoomModal(Number(id), name, Number(price));
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-add-cart]");
    if (!btn) return;
    var modal = $("#roomsModal");
    if (modal && modal.classList.contains("active")) {
      e.preventDefault();
      onAddToCartClick(
        btn.dataset.addCart,
        btn.dataset.name,
        btn.dataset.price,
      );
      return;
    }
    var grid = $("#roomsGrid");
    if (grid && grid.contains(btn)) {
      e.preventDefault();
      onAddToCartClick(
        btn.dataset.addCart,
        btn.dataset.name,
        btn.dataset.price,
      );
    }
  });

  function toQuoteRoomId(id) {
    var s = String(id == null ? "" : id).replace(/^R/i, "");
    var n = parseInt(s, 10);
    if (!isNaN(n)) return (n < 10 ? "0" : "") + String(n);
    return s;
  }

  function normalizeCapacity(cap) {
    if (!cap || typeof cap !== "object") return null;
    if (cap.minAdults != null && cap.maxAdults != null) return cap;
    if (cap.adults != null) {
      var maxA = cap.adults;
      var maxC = cap.children != null ? cap.children : 0;
      return {
        minAdults: 1,
        maxAdults: maxA,
        maxChildren: maxC,
        maxTotal: maxA + maxC,
      };
    }
    return null;
  }

  function roomCapacityLookupKeys(r) {
    var keys = [];
    if (r.roomId) {
      keys.push(String(r.roomId), toQuoteRoomId(r.roomId));
    }
    if (r.id != null) {
      keys.push(String(r.id), "R" + r.id, toQuoteRoomId(r.id));
    }
    return keys;
  }

  function getRoomCapacityForId(roomNumericId) {
    var keys = [
      toQuoteRoomId(roomNumericId),
      "R" + roomNumericId,
      String(roomNumericId),
    ];
    for (var i = 0; i < keys.length; i++) {
      var cap = roomsCapacityByRoomId[keys[i]];
      if (cap) return cap;
    }
    return null;
  }

  function buildQuoteBody(checkIn, checkOut, adults, children, roomNumericId) {
    return {
      adults: adults,
      checkIn: checkIn,
      checkOut: checkOut,
      children: children,
      roomId: toQuoteRoomId(roomNumericId),
    };
  }

  function checkDatesAvailability() {
    var checkIn = $("#bookRoomCheckIn") && $("#bookRoomCheckIn").value;
    var checkOut = $("#bookRoomCheckOut") && $("#bookRoomCheckOut").value;
    var availEl = $("#bookRoomAvailability");
    if (!availEl || !pendingBookRoom || !checkIn || !checkOut) {
      if (availEl) availEl.textContent = "";
      return;
    }
    var adults = parseInt($("#bookRoomAdults") && $("#bookRoomAdults").value, 10) || 1;
    var children = parseInt($("#bookRoomChildren") && $("#bookRoomChildren").value, 10) || 0;
    availEl.textContent = "Checking availability…";
    availEl.classList.remove(
      "form__availability--ok",
      "form__availability--error",
    );
    if (!Vara) return;
    Vara.public
      .quote(buildQuoteBody(checkIn, checkOut, adults, children, pendingBookRoom.id))
      .then(function (result) {
        if (result.ok) {
          availEl.textContent = "Rooms are available.";
          availEl.classList.add("form__availability--ok");
          availEl.classList.remove("form__availability--error");
        } else {
          availEl.textContent = result.message || "Dates not available.";
          availEl.classList.add("form__availability--error");
          availEl.classList.remove("form__availability--ok");
        }
      })
      .catch(function () {
        availEl.textContent = "";
        availEl.classList.remove(
          "form__availability--ok",
          "form__availability--error",
        );
      });
  }

  var bookRoomCheckIn = $("#bookRoomCheckIn");
  if (bookRoomCheckIn) {
    bookRoomCheckIn.addEventListener("change", function () {
      var co = $("#bookRoomCheckOut");
      if (co && bookRoomCheckIn.value) co.min = bookRoomCheckIn.value;
      checkDatesAvailability();
    });
  }
  var bookRoomCheckOut = $("#bookRoomCheckOut");
  if (bookRoomCheckOut) {
    bookRoomCheckOut.addEventListener("change", checkDatesAvailability);
  }

  var bookRoomAdultsEl = $("#bookRoomAdults");
  var bookRoomChildrenEl = $("#bookRoomChildren");
  function onBookRoomGuestInput() {
    if (pendingBookRoom && pendingBookRoom.capacity) {
      clampBookRoomGuests(pendingBookRoom.capacity);
    }
    checkDatesAvailability();
  }
  if (bookRoomAdultsEl) bookRoomAdultsEl.addEventListener("input", onBookRoomGuestInput);
  if (bookRoomChildrenEl) bookRoomChildrenEl.addEventListener("input", onBookRoomGuestInput);

  var bookRoomForm = $("#bookRoomForm");
  if (bookRoomForm) {
    bookRoomForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!pendingBookRoom) return;
      var errEl = $("#bookRoomError");
      var submitBtn = $("#bookRoomSubmitBtn");
      var apiRoomId = toQuoteRoomId(pendingBookRoom.id);
      if (
        validRoomIdsFromBackend.length > 0 &&
        !validRoomIdsFromBackend.some(function (id) {
          return toQuoteRoomId(id) === apiRoomId;
        })
      ) {
        errEl.textContent = "This room is not available for booking.";
        return;
      }
      var checkIn = $("#bookRoomCheckIn").value;
      var checkOut = $("#bookRoomCheckOut").value;
      var adults = parseInt($("#bookRoomAdults").value, 10) || 1;
      var children = parseInt($("#bookRoomChildren").value, 10) || 0;
      errEl.textContent = "";
      var cap = pendingBookRoom && pendingBookRoom.capacity;
      if (cap) {
        clampBookRoomGuests(cap);
        adults = parseInt($("#bookRoomAdults").value, 10) || cap.minAdults;
        children = parseInt($("#bookRoomChildren").value, 10) || 0;
      }
      var guestErr = validateGuestAgainstCapacity(cap, adults, children);
      if (guestErr) {
        errEl.textContent = guestErr;
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      try {
        if (!Vara) {
          errEl.textContent = "Booking service unavailable. Please refresh.";
          return;
        }
        var quoteBody = buildQuoteBody(
          checkIn,
          checkOut,
          adults,
          children,
          pendingBookRoom.id,
        );
        var availResult = await Vara.public.quote(quoteBody);
        if (!availResult.ok) {
          errEl.textContent =
            availResult.message || "Selected dates are not available.";
          return;
        }
        if (!getGuestToken()) {
          errEl.textContent = "Please sign in to add this room to your cart.";
          openModal("#signInModal");
          setTimeout(renderSignInButton, 50);
          return;
        }
        var cartResult = await Vara.bookings.addCartItem(quoteBody);
        if (!cartResult.ok) {
          if (cartResult.status === 401) {
            errEl.textContent = "Please sign in to add this room to your cart.";
            openModal("#signInModal");
            setTimeout(renderSignInButton, 50);
            return;
          }
          errEl.textContent = cartResult.message || "Could not add to cart.";
          return;
        }
        closeAllModals();
        var infoEl = $("#roomAddedInfo");
        var roomAddedModal = $("#roomAddedModal");
        if (infoEl)
          infoEl.textContent =
            pendingBookRoom.name + " — ₹" + pendingBookRoom.price + " / night";
        if (roomAddedModal) openModal("#roomAddedModal");
        pendingBookRoom = null;
        fetchCartCount();
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // --- Modal logic ---
  function openModal(id) {
    closeAllModals();
    $(id).classList.add("active");
  }

  function closeAllModals() {
    $$(".modal").forEach((m) => m.classList.remove("active"));
    $$(".form__error").forEach((e) => (e.textContent = ""));
    $$(".form__success").forEach((e) => (e.textContent = ""));
    $$(".form__availability").forEach((e) => {
      e.textContent = "";
      e.classList.remove("form__availability--ok", "form__availability--error");
    });
  }

  $$(".modal__overlay, .modal__close, [data-close]").forEach((el) => {
    el.addEventListener("click", closeAllModals);
  });

  // --- Auth UI: Sign In (when logged out) / Profile dropdown (when logged in) ---
  const DEFAULT_AVATAR_URL = "/img/default-avatar.svg";
  function updateAuthUI() {
    const authBtn = $("#authBtn");
    const navProfile = $("#navProfile");
    const navProfileAvatar = $("#navProfileAvatar");
    const navProfileDropdown = $("#navProfileDropdown");
    if (!authBtn || !navProfile) return;
    if (currentUser) {
      authBtn.style.display = "none";
      navProfile.style.display = "block";
      navProfile.setAttribute("aria-hidden", "false");
      if (navProfileAvatar) {
        var imageUrl = (currentUser.avatar || currentUser.picture || "").trim();
        navProfileAvatar.src = imageUrl ? imageUrl : DEFAULT_AVATAR_URL;
        navProfileAvatar.alt = currentUser.name
          ? String(currentUser.name)
          : "Profile";
      }
      if (navProfileDropdown) navProfileDropdown.classList.remove("is-open");
    } else {
      authBtn.style.display = "";
      navProfile.style.display = "none";
      navProfile.setAttribute("aria-hidden", "true");
      if (navProfileAvatar) navProfileAvatar.src = DEFAULT_AVATAR_URL;
      if (navProfileDropdown) navProfileDropdown.classList.remove("is-open");
    }
    if (typeof refreshChatbotAuthUI === "function") refreshChatbotAuthUI();
  }

  $("#authBtn").addEventListener("click", () => {
    openModal("#signInModal");
  });

  updateAuthUI();

  // --- Profile dropdown ---
  const navProfileTrigger = $("#navProfileTrigger");
  const navProfileDropdown = $("#navProfileDropdown");
  if (navProfileTrigger && navProfileDropdown) {
    navProfileTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = navProfileDropdown.classList.toggle("is-open");
      navProfileTrigger.setAttribute(
        "aria-expanded",
        isOpen ? "true" : "false",
      );
    });
    navProfileDropdown.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => {
      navProfileDropdown.classList.remove("is-open");
      if (navProfileTrigger)
        navProfileTrigger.setAttribute("aria-expanded", "false");
    });
  }

  const navProfileLogout = $("#navProfileLogout");
  if (navProfileLogout) {
    navProfileLogout.addEventListener("click", () => {
      clearGuestToken();
      currentUser = null;
      updateAuthUI();
    });
  }
  function escapeBookingHtml(s) {
    return String(s == null ? "" : s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function renderMyBookingsRoomRow(b) {
    var status = (b.status || "pending").toLowerCase();
    var guestName = b.guest && b.guest.name ? b.guest.name : "—";
    var rooms = b.rooms || [];
    var roomsSummary = rooms.length
      ? rooms
        .map(function (r) {
          return r.roomName || r.roomId || "—";
        })
        .join(", ")
      : "—";
    var checkIn =
      rooms[0] && rooms[0].checkIn
        ? new Date(rooms[0].checkIn).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
        : "—";
    var checkOut =
      rooms[0] && rooms[0].checkOut
        ? new Date(rooms[0].checkOut).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
        : "—";
    return (
      '<div class="my-bookings__item">' +
      '<span class="my-bookings__guest">' +
      escapeBookingHtml(guestName) +
      "</span>" +
      '<span class="my-bookings__rooms">' +
      escapeBookingHtml(roomsSummary) +
      "</span>" +
      '<span class="my-bookings__dates">' +
      checkIn +
      " – " +
      checkOut +
      "</span>" +
      '<span class="my-bookings__total">₹' +
      (b.totalAmount != null ? Number(b.totalAmount).toLocaleString("en-IN") : "0") +
      "</span>" +
      '<span class="my-bookings__status my-bookings__status--' +
      status +
      '">' +
      status +
      "</span>" +
      "</div>"
    );
  }
  function renderMyBookingsEventRow(b) {
    var status = (b.status || "pending").toLowerCase();
    var guestName = b.guest && b.guest.name ? b.guest.name : "—";
    var event = b.eventId || b.event;
    var title =
      event && event.name
        ? event.name
        : event && event._id
          ? String(event._id)
          : "—";
    var checkIn =
      event && event.startDate
        ? new Date(event.startDate).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
        : "—";
    var checkOut =
      event && event.endDate
        ? new Date(event.endDate).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
        : "—";
    return (
      '<div class="my-bookings__item">' +
      '<span class="my-bookings__guest">' +
      escapeBookingHtml(guestName) +
      "</span>" +
      '<span class="my-bookings__rooms">' +
      escapeBookingHtml(title) +
      "</span>" +
      '<span class="my-bookings__dates">' +
      checkIn +
      " – " +
      checkOut +
      "</span>" +
      '<span class="my-bookings__total">₹' +
      (b.totalAmount != null ? Number(b.totalAmount).toLocaleString("en-IN") : "0") +
      "</span>" +
      '<span class="my-bookings__status my-bookings__status--' +
      status +
      '">' +
      status +
      "</span>" +
      "</div>"
    );
  }
  function fillMyBookingsModal(roomsBookings, eventBookings) {
    var listRoomsEl = $("#myBookingsRoomsList");
    var listEventsEl = $("#myBookingsEventsList");
    var emptyRoomsEl = $("#myBookingsRoomsEmpty");
    var emptyEventsEl = $("#myBookingsEventsEmpty");
    var rooms = roomsBookings || [];
    var events = eventBookings || [];
    if (listRoomsEl) {
      listRoomsEl.innerHTML = rooms.map(renderMyBookingsRoomRow).join("");
    }
    if (emptyRoomsEl) {
      emptyRoomsEl.style.display = rooms.length === 0 ? "block" : "none";
    }
    if (listEventsEl) {
      listEventsEl.innerHTML = events.map(renderMyBookingsEventRow).join("");
    }
    if (emptyEventsEl) {
      emptyEventsEl.style.display = events.length === 0 ? "block" : "none";
    }
  }

  const navProfileBookings = $("#navProfileBookings");
  if (navProfileBookings) {
    navProfileBookings.addEventListener("click", (e) => {
      e.preventDefault();
      if (navProfileDropdown) navProfileDropdown.classList.remove("is-open");
      const navLinks = $("#navLinks");
      if (navLinks) navLinks.classList.remove("open");

      var emptyEl = $("#myBookingsError");
      if (emptyEl) {
        emptyEl.style.display = "none";
        emptyEl.textContent = "";
      }

      if (!Vara) {
        if (emptyEl) {
          emptyEl.textContent = "Booking service unavailable.";
          emptyEl.style.display = "block";
        }
        fillMyBookingsModal([], []);
        openModal("#myBookingsModal");
        return;
      }

      Promise.all([Vara.bookings.listBookings(), Vara.events.listBookings()])
        .then(function (results) {
          var roomsResult = results[0];
          var eventsResult = results[1];
          if (!roomsResult.ok && roomsResult.status === 401) {
            if (emptyEl) {
              emptyEl.textContent =
                roomsResult.message || "Please sign in to view bookings.";
              emptyEl.style.display = "block";
            }
            fillMyBookingsModal([], []);
            openModal("#myBookingsModal");
            return;
          }
          fillMyBookingsModal(
            roomsResult.ok ? roomsResult.bookings : [],
            eventsResult.ok ? eventsResult.bookings : []
          );
          openModal("#myBookingsModal");
        })
        .catch(function () {
          if (emptyEl) {
            emptyEl.textContent = "Could not load bookings.";
            emptyEl.style.display = "block";
          }
          fillMyBookingsModal([], []);
          openModal("#myBookingsModal");
        });
    });
  }

  // --- Google Sign In ---
  // Eagerly initialise and render the button once the async GSI script resolves.
  function tryEagerGsiInit() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      initGoogleIdentity();
      renderSignInButton();
    }
  }
  tryEagerGsiInit();
  window.addEventListener("load", tryEagerGsiInit);
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(tryEagerGsiInit, { timeout: 3000 });
  }

  // Re-render the button whenever the sign-in modal is opened
  // (the container may have been empty before GSI was ready)
  const authBtn = $("#authBtn");
  if (authBtn) {
    authBtn.addEventListener("click", function () {
      openModal("#signInModal");
      // Small delay to let the modal become visible before measuring container width
      setTimeout(renderSignInButton, 50);
    });
  }

  // --- Auth check: used before booking and for redirect after sign-in ---
  async function checkAuth(cb) {
    try {
      const token = getGuestToken();
      if (!token) {
        currentUser = null;
        updateAuthUI();
        const countEl = $("#navCartCount");
        if (countEl) {
          countEl.textContent = "0";
          countEl.setAttribute("data-count", "0");
        }
        if (cb) cb(null);
        return;
      }

      if (!Vara) throw new Error("unavailable");
      const cartResult = await Vara.bookings.getCart();
      if (!cartResult.ok) throw new Error("unauthorized");

      var profile = Vara.guestProfileFromToken(token);
      currentUser = profile || { name: "Guest", picture: "", email: "" };
      updateAuthUI();
      fetchCartCount();
      if (cb) cb(currentUser);
    } catch {
      currentUser = null;
      updateAuthUI();
      if (cb) cb(null);
    }
  }

  async function fetchCartCount() {
    try {
      if (!Vara || !getGuestToken()) return;
      const result = await Vara.bookings.getCart();
      if (!result.ok) return;
      const count = (result.cart && result.cart.roomInfo && result.cart.roomInfo.length) || 0;
      const countEl = $("#navCartCount");
      if (countEl) {
        countEl.textContent = count;
        countEl.setAttribute("data-count", count);
      }
    } catch (_) { }
  }

  let pendingBookRoom = null;

  function clampBookRoomGuests(cap) {
    var adultsEl = $("#bookRoomAdults");
    var childrenEl = $("#bookRoomChildren");
    if (!adultsEl || !childrenEl || !cap) return;
    var a = parseInt(adultsEl.value, 10);
    var c = parseInt(childrenEl.value, 10);
    if (Number.isNaN(a)) a = cap.minAdults;
    if (Number.isNaN(c)) c = 0;
    if (a < cap.minAdults) a = cap.minAdults;
    if (a > cap.maxAdults) a = cap.maxAdults;
    if (c < 0) c = 0;
    if (c > cap.maxChildren) c = cap.maxChildren;
    if (a + c > cap.maxTotal) {
      c = Math.min(c, cap.maxTotal - a);
      if (c < 0) c = 0;
      if (a + c > cap.maxTotal) {
        a = Math.max(cap.minAdults, cap.maxTotal - c);
        if (a > cap.maxAdults) {
          a = cap.maxAdults;
          c = Math.max(0, cap.maxTotal - a);
          if (c > cap.maxChildren) c = cap.maxChildren;
        }
      }
    }
    adultsEl.value = String(a);
    childrenEl.value = String(c);
  }

  function applyBookRoomGuestLimits(cap) {
    var adultsEl = $("#bookRoomAdults");
    var childrenEl = $("#bookRoomChildren");
    if (!adultsEl || !childrenEl || !cap) return;
    adultsEl.setAttribute("min", String(cap.minAdults));
    adultsEl.setAttribute("max", String(cap.maxAdults));
    childrenEl.setAttribute("min", "0");
    childrenEl.setAttribute("max", String(cap.maxChildren));
    adultsEl.value = String(cap.minAdults);
    childrenEl.value = "0";
    clampBookRoomGuests(cap);
  }

  function validateGuestAgainstCapacity(cap, adults, children) {
    if (!cap) {
      if (adults < 1) return "At least 1 adult is required.";
      if (children < 0) return "Invalid number of children.";
      return null;
    }
    if (adults < cap.minAdults) {
      return "At least " + cap.minAdults + " adult(s) required.";
    }
    if (adults > cap.maxAdults) {
      return "Too many adults for this room.";
    }
    if (children > cap.maxChildren) {
      return "Too many children for this room.";
    }
    if (adults + children > cap.maxTotal) {
      return "Total guest limit exceeded for this room.";
    }
    return null;
  }

  function openBookRoomModal(roomId, roomName, roomPrice) {
    var cap = getRoomCapacityForId(roomId);
    pendingBookRoom = {
      id: roomId,
      name: roomName,
      price: roomPrice,
      capacity: cap || null,
    };
    const nameEl = $("#bookRoomName");
    if (nameEl) nameEl.textContent = roomName;
    const errEl = $("#bookRoomError");
    if (errEl) errEl.textContent = "";
    const today = new Date().toISOString().slice(0, 10);
    const checkIn = $("#bookRoomCheckIn");
    const checkOut = $("#bookRoomCheckOut");
    if (checkIn) {
      checkIn.value = "";
      checkIn.min = today;
    }
    if (checkOut) {
      checkOut.value = "";
      checkOut.min = today;
    }
    const adults = $("#bookRoomAdults");
    const children = $("#bookRoomChildren");
    if (cap) {
      applyBookRoomGuestLimits(cap);
    } else {
      if (adults) {
        adults.value = "1";
        adults.removeAttribute("max");
        adults.setAttribute("min", "1");
      }
      if (children) {
        children.value = "0";
        children.removeAttribute("max");
        children.setAttribute("min", "0");
      }
    }
    openModal("#bookRoomModal");
  }

  function updateRoomCartButtons() {
    $$("[data-add-cart]").forEach((btn) => {
      if (btn) btn.textContent = "Add to cart";
    });
  }

  function updateCartUI() {
    fetchCartCount();
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // --- Render rooms ---
  async function renderRooms() {
    try {
      if (!Vara) return;
      const result = await Vara.public.getRooms();
      const rooms = result.rooms || [];
      if (!result.ok || !Array.isArray(rooms) || rooms.length === 0) return;
      validRoomIdsFromBackend = rooms.map(function (r) {
        return r.roomId || (r.id != null ? "R" + r.id : "");
      }).filter(Boolean);
      roomsCapacityByRoomId = {};
      rooms.forEach(function (r) {
        var cap = normalizeCapacity(r.capacity);
        if (!cap) return;
        roomCapacityLookupKeys(r.raw || r).forEach(function (key) {
          if (key) roomsCapacityByRoomId[key] = cap;
        });
      });
      const grid = $("#roomsGrid");
      grid.innerHTML = rooms
        .map(
          (room, idx) => {
            const imgSrc =
              room.images && room.images.banner
                ? room.images.banner
                : "/img/summary%20green.jpeg";
            const roomImages = [];
            if (room.images && room.images.banner) roomImages.push(room.images.banner);
            if (room.images && room.images.gallery && room.images.gallery.length)
              roomImages.push(...room.images.gallery);
            const roomImagesJson = roomImages.length ? JSON.stringify(roomImages) : "";
            const price = room.price != null ? room.price : 0;
            return `
        <div class="room-card"${roomImagesJson ? ' data-room-images="' + roomImagesJson.replace(/"/g, "&quot;") + '" data-room-name="' + (room.name || "").replace(/"/g, "&quot;") + '"' : ""}>
          <div class="room-card__media">
            <img loading="lazy" alt="${escapeHtml(room.name)} cover" src="${imgSrc}">
          </div>
          <span class="room-card__number">${room.id != null ? "0" + room.id : ""}</span>
          <h3 class="room-card__name">${escapeHtml(room.name)}</h3>
          <p class="room-card__desc">${escapeHtml(room.description)}</p>
          <p class="room-card__price"><span>₹${price}</span> / night</p>
          <div class="room-card__actions">
            <button type="button" class="btn btn--outline btn--sm" data-add-cart="${room.id != null ? room.id : (room.roomId ? String(room.roomId).replace(/^R/i, "") : "")}" data-name="${escapeHtml(room.name)}" data-price="${price}">Add to cart</button>
          </div>
          <div class="room-card__overlay">
            <div class="room-card__overlay-inner">
              <h3 class="room-card__overlay-title">${escapeHtml(room.name)}</h3>
              <p class="room-card__overlay-desc">${escapeHtml(room.description)}</p>
              <p class="room-card__overlay-meta">From ₹${price} / night</p>
            </div>
          </div>
        </div>
      `;
          },
        )
        .join("");
      if (window.refreshScrollReveals) window.refreshScrollReveals();
      if (window.initRoomCardHover) window.initRoomCardHover();
      updateCartUI();
      updateRoomCartButtons();
    } catch {
      /* silent */
    }
  }

  // --- Room card hover: JS-driven description expand (desktop only) ---
  function isIpadWideTouchNoHover() {
    try {
      return window.matchMedia(
        "(min-width: 1025px) and (max-width: 1366px) and (hover: none)"
      ).matches;
    } catch (e) {
      return false;
    }
  }

  /** iPad / touch tablet only: coarse pointer + no hover (excludes laptop mouse: pointer fine + hover). */
  function isIpadTouchView() {
    try {
      return window.matchMedia(
        "(min-width: 768px) and (max-width: 1366px) and (pointer: coarse) and (hover: none)"
      ).matches;
    } catch (err) {
      return false;
    }
  }

  function expandRoomDesc(card) {
    var desc = card.querySelector(".room-card__desc");
    if (!desc) return;
    card.classList.add("is-hovered");
    desc.style.setProperty("max-height", desc.scrollHeight + "px", "important");
    desc.style.setProperty("opacity", "1", "important");
    desc.style.setProperty("transform", "translateY(0)", "important");
    desc.style.setProperty("margin-bottom", "1rem", "important");
    desc.style.setProperty("overflow", "visible", "important");
  }

  function collapseRoomDesc(card) {
    var desc = card.querySelector(".room-card__desc");
    if (!desc) return;
    card.classList.remove("is-hovered");
    desc.style.setProperty("max-height", "0", "important");
    desc.style.setProperty("opacity", "0", "important");
    desc.style.setProperty("transform", "translateY(16px)", "important");
    desc.style.setProperty("margin-bottom", "0", "important");
    desc.style.setProperty("overflow", "hidden", "important");
  }

  function collapseOtherIpadDescs(exceptCard) {
    document.querySelectorAll(".room-card[data-desc-expanded='1']").forEach(function (c) {
      if (c !== exceptCard) {
        collapseRoomDesc(c);
        c.removeAttribute("data-desc-expanded");
      }
    });
  }

  function initRoomCardHover() {
    if (isIpadTouchView()) return;
    if (window.innerWidth <= 1024) return;
    if (isIpadWideTouchNoHover()) return;
    document.querySelectorAll(".room-card").forEach(function (card) {
      var desc = card.querySelector(".room-card__desc");
      if (!desc) return;

      card.addEventListener("mouseenter", function () {
        expandRoomDesc(card);
      });
      card.addEventListener("mouseleave", function () {
        collapseRoomDesc(card);
      });
    });
  }

  window.initRoomCardHover = initRoomCardHover;

  (function cleanupDesktopHoverOnResize() {
    var mqlNarrow = window.matchMedia("(max-width: 1024px)");
    var mqlIpadTouchWide = window.matchMedia(
      "(min-width: 1025px) and (max-width: 1366px) and (hover: none)"
    );
    function strip() {
      document.querySelectorAll(".room-card__desc").forEach(function (desc) {
        desc.style.removeProperty("max-height");
        desc.style.removeProperty("opacity");
        desc.style.removeProperty("transform");
        desc.style.removeProperty("margin-bottom");
        desc.style.removeProperty("overflow");
      });
      document.querySelectorAll(".room-card[data-desc-expanded]").forEach(function (c) {
        c.removeAttribute("data-desc-expanded");
        c.classList.remove("is-hovered");
      });
    }
    function stripIfNeeded() {
      if (mqlNarrow.matches || mqlIpadTouchWide.matches) strip();
    }
    stripIfNeeded();
    mqlNarrow.addEventListener("change", function (e) {
      if (e.matches) strip();
    });
    mqlIpadTouchWide.addEventListener("change", function (e) {
      if (e.matches) strip();
    });
  })();

  // --- Gallery filter ---
  $$(".gallery__filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".gallery__filter").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      $$(".gallery__item").forEach((item) => {
        if (filter === "all" || item.dataset.category === filter) {
          item.classList.remove("hidden");
        } else {
          item.classList.add("hidden");
        }
      });
    });
  });

  // --- Gallery image click: full-screen popup ---
  var galleryGrid = $("#galleryGrid");
  if (galleryGrid) {
    galleryGrid.addEventListener("click", function (e) {
      var item = e.target.closest(".gallery__item");
      if (!item || item.classList.contains("hidden")) return;
      var img = item.querySelector(".gallery__img");
      if (!img) return;
      e.preventDefault();
      var lbImg = $("#galleryLightboxImg");
      var lb = $("#galleryLightbox");
      if (lbImg && lb) {
        lbImg.src = img.src || img.currentSrc;
        lbImg.alt = img.alt || "";
        openModal("#galleryLightbox");
      }
    });
  }

  // --- Room card click: open room gallery (banner + gallery images from admin) ---
  var roomGalleryUrls = [];
  var roomGalleryIndex = 0;
  var roomGalleryImg = $("#roomGalleryImg");
  var roomGalleryCounter = $("#roomGalleryCounter");
  var roomGalleryPrev = $("#roomGalleryPrev");
  var roomGalleryNext = $("#roomGalleryNext");

  function toJpegUrl(url) {
    if (!url || typeof url !== "string") return url;
    if (url.indexOf("cloudinary.com") !== -1 && url.indexOf("/upload/") !== -1) {
      return url.replace("/upload/", "/upload/f_jpg/");
    }
    return url;
  }

  function updateRoomGalleryImage() {
    if (!roomGalleryImg || !roomGalleryUrls.length) return;
    var idx = roomGalleryIndex;
    if (idx < 0) idx = 0;
    if (idx >= roomGalleryUrls.length) idx = roomGalleryUrls.length - 1;
    roomGalleryIndex = idx;
    roomGalleryImg.src = toJpegUrl(roomGalleryUrls[roomGalleryIndex]);
    roomGalleryImg.alt = "Room image " + (roomGalleryIndex + 1);
    if (roomGalleryCounter) {
      roomGalleryCounter.textContent = (roomGalleryIndex + 1) + " / " + roomGalleryUrls.length;
    }
    if (roomGalleryPrev) roomGalleryPrev.style.visibility = roomGalleryUrls.length > 1 ? "visible" : "hidden";
    if (roomGalleryNext) roomGalleryNext.style.visibility = roomGalleryUrls.length > 1 ? "visible" : "hidden";
  }

  function openRoomGallery(urls, roomName) {
    if (!urls || !urls.length || !roomGalleryImg) return;
    roomGalleryUrls = urls;
    roomGalleryIndex = 0;
    updateRoomGalleryImage();
    openModal("#roomGalleryModal");
  }

  var roomsGridEl = $("#roomsGrid");
  if (roomsGridEl) {
    roomsGridEl.addEventListener("click", function (e) {
      var card = e.target.closest(".room-card");
      if (!card) return;
      if (e.target.closest("[data-add-cart]") || e.target.closest(".room-card__actions")) return;
      var raw = card.getAttribute("data-room-images");
      var urls = [];
      if (raw) {
        try {
          urls = JSON.parse(raw);
        } catch (err) { }
      }
      var name = card.getAttribute("data-room-name") || "";

      if (isIpadTouchView()) {
        // iPad: banner → gallery; rest of card → same expand/collapse as desktop hover
        if (e.target.closest(".room-card__media")) {
          if (!urls.length) return;
          e.preventDefault();
          openRoomGallery(urls, name);
          return;
        }
        e.preventDefault();
        collapseOtherIpadDescs(card);
        if (card.getAttribute("data-desc-expanded") === "1") {
          collapseRoomDesc(card);
          card.removeAttribute("data-desc-expanded");
        } else {
          expandRoomDesc(card);
          card.setAttribute("data-desc-expanded", "1");
        }
        return;
      }

      if (!raw) return;
      if (!urls.length) return;
      e.preventDefault();
      openRoomGallery(urls, name);
    });
  }

  if (roomGalleryPrev) {
    roomGalleryPrev.addEventListener("click", function (e) {
      e.preventDefault();
      if (roomGalleryUrls.length <= 1) return;
      roomGalleryIndex = (roomGalleryIndex - 1 + roomGalleryUrls.length) % roomGalleryUrls.length;
      updateRoomGalleryImage();
    });
  }
  if (roomGalleryNext) {
    roomGalleryNext.addEventListener("click", function (e) {
      e.preventDefault();
      if (roomGalleryUrls.length <= 1) return;
      roomGalleryIndex = (roomGalleryIndex + 1) % roomGalleryUrls.length;
      updateRoomGalleryImage();
    });
  }

  // --- Directions button (maps) ---
  function setupDirections() {
    const btn = $("#getDirectionsBtn");
    if (!btn) return;
    const address = "Via dei Cipressi 42, Tuscany, Italy";
    btn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    btn.target = "_blank";
  }

  // --- Directions map: no wheel capture so page scroll works over map; zoom via "Open in Google Maps" ---
  (function initDirectionsMap() {
    const iframe = document.getElementById("directionsMapIframe");
    const mapWrap = document.querySelector(".directions__map-wrap");
    if (!iframe || !mapWrap) return;
    // Map uses fixed zoom; user can open in Google Maps for full zoom/pan. Page scroll works over map.
  })();

  // --- Events media slider: left/right arrows + 7s autoplay ---
  (function initEventsSlider() {
    var sectionEl = document.getElementById("events");
    var imgEl = document.getElementById("eventsImage");
    var prevBtn = document.getElementById("eventsPrev");
    var nextBtn = document.getElementById("eventsNext");
    var titleEl = document.querySelector(".events__title");
    var subtitleEl = document.querySelector(".events__content .section__subtitle");
    var textEls = document.querySelectorAll(".events__text");
    var brochureBtn = document.querySelector(".events__brochure-btn");
    var bookEventBtn = document.querySelector(".events__book-btn");
    var photosBtn = document.getElementById("eventsPhotosBtn");
    var eventPhotosModal = document.getElementById("eventPhotosModal");
    var eventPhotosModalTitle = document.getElementById("eventPhotosModalTitle");
    var eventPhotosModalImg = document.getElementById("eventPhotosModalImg");
    var eventPhotosPrev = document.getElementById("eventPhotosPrev");
    var eventPhotosNext = document.getElementById("eventPhotosNext");
    var eventPhotosCounter = document.getElementById("eventPhotosCounter");
    var eventPhotosUrls = [];
    var eventPhotosIdx = 0;
    var activeEvent = null;
    var pendingBookEvent = null;

    var bookEventForm = $("#bookEventForm");
    var bookEventGuestNameInput = $("#bookEventGuestName");
    var bookEventEmailInput = $("#bookEventEmail");
    var bookEventPhoneInput = $("#bookEventPhone");
    var bookEventGuestCountInput = $("#bookEventGuestCount");
    var bookEventErrorEl = $("#bookEventError");
    var bookEventSuccessEl = $("#bookEventSuccess");
    var bookEventNameEl = $("#bookEventName");
    var bookEventInfoEl = $("#bookEventInfo");
    var bookEventTotalInfoEl = $("#bookEventTotalInfo");
    var bookEventSubmitBtn = $("#bookEventSubmitBtn");

    if (!sectionEl || !imgEl || !prevBtn || !nextBtn || !titleEl || !subtitleEl || textEls.length < 1) return;

    function showEventsEmptyState() {
      if (subtitleEl) {
        subtitleEl.textContent = "What We Offer";
        subtitleEl.style.display = "";
      }
      titleEl.textContent = "Events at Prathibhimba";
      if (textEls[0]) {
        textEls[0].textContent = "Currently no events available";
        textEls[0].style.display = "";
      }
      if (textEls[1]) textEls[1].style.display = "none";
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
      activeEvent = null;
      pendingBookEvent = null;
      if (bookEventBtn) bookEventBtn.style.display = "none";
      if (brochureBtn) {
        brochureBtn.style.display = "";
        brochureBtn.href = "/brochure.pdf";
      }
      if (photosBtn) photosBtn.style.display = "none";
    }

    function formatISODate(d) {
      return d ? new Date(d).toISOString().slice(0, 10) : "—";
    }

    function openBookEventModal(ev) {
      if (!ev) return;
      pendingBookEvent = ev;
      activeEvent = ev;

      if (bookEventNameEl) bookEventNameEl.textContent = ev.title || "Event";

      var startLabel = ev.startDate ? formatISODate(ev.startDate) : "—";
      var endLabel = ev.endDate ? formatISODate(ev.endDate) : "—";
      if (bookEventInfoEl)
        bookEventInfoEl.textContent = "Dates: " + startLabel + " - " + endLabel;

      var pricePerPerson = ev.pricePerPerson != null ? Number(ev.pricePerPerson) : 0;
      var availableSpots =
        ev.maxPeopleAllowed != null && ev.curPeopleEnrolled != null
          ? Number(ev.maxPeopleAllowed) - Number(ev.curPeopleEnrolled)
          : 0;
      var maxGuest = Math.min(2, Math.max(1, availableSpots));

      if (bookEventGuestCountInput) {
        bookEventGuestCountInput.max = String(maxGuest);
        bookEventGuestCountInput.value =
          Number(bookEventGuestCountInput.value) > maxGuest
            ? String(maxGuest)
            : bookEventGuestCountInput.value || "1";
      }

      if (bookEventErrorEl) bookEventErrorEl.textContent = "";
      if (bookEventSuccessEl) {
        bookEventSuccessEl.textContent = "";
        bookEventSuccessEl.style.display = "none";
      }

      function syncTotal() {
        if (!pendingBookEvent || !bookEventTotalInfoEl || !bookEventGuestCountInput)
          return;
        var count = Number(bookEventGuestCountInput.value) || 1;
        var total = pricePerPerson * count;
        bookEventTotalInfoEl.textContent =
          "₹" +
          pricePerPerson +
          " per person · Total: ₹" +
          Number(total).toLocaleString("en-IN");
      }

      syncTotal();

      if (bookEventSubmitBtn) {
        bookEventSubmitBtn.textContent =
          pricePerPerson <= 0 ? "Confirm booking" : "Book & Pay";
      }

      if (availableSpots <= 0 && bookEventSubmitBtn) {
        bookEventSubmitBtn.disabled = true;
        if (bookEventErrorEl) bookEventErrorEl.textContent = "No spots available for this event.";
      } else if (bookEventSubmitBtn) {
        bookEventSubmitBtn.disabled = false;
      }

      openModal("#bookEventModal");

      if (bookEventGuestCountInput) {
        bookEventGuestCountInput.oninput = syncTotal;
      }
    }

    function initBookEventForm() {
      if (!bookEventForm) return;

      if (bookEventGuestCountInput) {
        bookEventGuestCountInput.addEventListener("input", function () {
          if (!pendingBookEvent) return;
          if (!bookEventTotalInfoEl || !bookEventGuestCountInput) return;
          var pricePerPerson =
            pendingBookEvent.pricePerPerson != null
              ? Number(pendingBookEvent.pricePerPerson)
              : 0;
          var count = Number(bookEventGuestCountInput.value) || 1;
          var total = pricePerPerson * count;
          bookEventTotalInfoEl.textContent =
            "₹" +
            pricePerPerson +
            " per person · Total: ₹" +
            Number(total).toLocaleString("en-IN");
        });
      }

      bookEventForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!pendingBookEvent) return;

        var guestName = bookEventGuestNameInput ? bookEventGuestNameInput.value.trim() : "";
        var guestEmail = bookEventEmailInput ? bookEventEmailInput.value.trim() : "";
        var guestPhone = bookEventPhoneInput ? bookEventPhoneInput.value.trim() : "";
        var guestCount = bookEventGuestCountInput ? Number(bookEventGuestCountInput.value) : 0;

        if (bookEventErrorEl) bookEventErrorEl.textContent = "";
        if (bookEventSuccessEl) bookEventSuccessEl.style.display = "none";

        if (!guestName || !guestEmail || !guestPhone || !guestCount) {
          if (bookEventErrorEl) bookEventErrorEl.textContent = "Please fill all guest details.";
          return;
        }
        if (guestCount !== 1 && guestCount !== 2) {
          if (bookEventErrorEl) bookEventErrorEl.textContent = "Guest count must be 1 or 2.";
          return;
        }

        if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = true;
        if (!Vara) {
          if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
          if (bookEventErrorEl) bookEventErrorEl.textContent = "Booking service unavailable.";
          return;
        }

        Vara.events
          .createBooking({
            eventId: pendingBookEvent.eventId,
            guest: {
              name: guestName,
              email: guestEmail,
              phone: guestPhone,
              guestCount: guestCount,
            },
          })
          .then(function (result) {
            if (!result.ok) {
              if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
              if (bookEventErrorEl) {
                if (result.status === 403) {
                  bookEventErrorEl.textContent =
                    result.message || "Event bookings are currently disabled for this property.";
                } else if (result.status === 401) {
                  bookEventErrorEl.textContent = "Please sign in to book this event.";
                  openModal("#signInModal");
                } else {
                  bookEventErrorEl.textContent =
                    result.message || "Could not create booking. Please try again.";
                }
              }
              return;
            }

            var booking = result.booking;

            // Free event: confirmed immediately — no Razorpay
            if (booking.confirmed && !booking.needsPayment) {
              if (bookEventSuccessEl) {
                bookEventSuccessEl.textContent =
                  result.message || "You're booked! This event is free — no payment needed.";
                bookEventSuccessEl.style.display = "block";
              }
              if (bookEventSubmitBtn) {
                bookEventSubmitBtn.disabled = false;
                bookEventSubmitBtn.textContent = "Booked";
              }
              return;
            }

            // Paid event: open Razorpay with order from createBooking response
            if (booking.needsPayment) {
              closeAllModals();

              if (!window.Razorpay) {
                alert("Razorpay checkout script not loaded. Please refresh and try again.");
                if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
                openBookEventModal(pendingBookEvent);
                return;
              }

              var options = {
                key: booking.key,
                amount: Math.round(Number(booking.totalAmount || 0) * 100),
                currency: "INR",
                order_id: booking.razorpayOrderId,
                name: "Prathibhimba",
                description: "Event Booking",
                prefill: {
                  name: guestName,
                  email: guestEmail,
                  contact: guestPhone,
                },
                handler: function (response) {
                  Vara.events
                    .verifyPayment({
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                    })
                    .then(function (vr) {
                      if (vr.ok) {
                        if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
                        window.location.href = "/?payment=success&type=event";
                      } else {
                        alert(
                          vr.message ||
                            "Payment verification failed. Please contact support."
                        );
                        if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
                        openBookEventModal(pendingBookEvent);
                      }
                    })
                    .catch(function () {
                      alert("Could not verify payment. Please contact support.");
                      if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
                      openBookEventModal(pendingBookEvent);
                    });
                },
                modal: {
                  ondismiss: function () {
                    if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
                    openBookEventModal(pendingBookEvent);
                  },
                },
              };

              var rzp = new window.Razorpay(options);

              rzp.on("payment.failed", function (response) {
                alert(
                  "Payment failed: " +
                  (response && response.error && response.error.description
                    ? response.error.description
                    : "Please try again.")
                );
                if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
                openBookEventModal(pendingBookEvent);
              });

              rzp.open();
              return;
            }

            if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
            if (bookEventErrorEl) {
              bookEventErrorEl.textContent =
                result.message || "Could not create booking. Please try again.";
            }
          })
          .catch(function () {
            if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
            if (bookEventErrorEl) bookEventErrorEl.textContent = "Network error. Please try again.";
          });
      });
    }

    // Hook up the "Book an Event" click
    if (bookEventBtn) {
      bookEventBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (!activeEvent) return;
        if (typeof checkAuth === "function") {
          checkAuth(function (loggedIn) {
            if (!loggedIn) {
              openModal("#signInModal");
              return;
            }
            openBookEventModal(activeEvent);
          });
        } else {
          openBookEventModal(activeEvent);
        }
      });
    }

    function showEventPhotoAt(index) {
      if (!eventPhotosUrls.length || !eventPhotosModalImg) return;
      var n = eventPhotosUrls.length;
      eventPhotosIdx = ((index % n) + n) % n;
      eventPhotosModalImg.src = eventPhotosUrls[eventPhotosIdx];
      eventPhotosModalImg.alt =
        (activeEvent && activeEvent.title ? activeEvent.title + " — " : "") +
        "photo " +
        (eventPhotosIdx + 1) +
        " of " +
        n;
      if (eventPhotosCounter) {
        eventPhotosCounter.textContent = eventPhotosIdx + 1 + " / " + n;
      }
      var showNav = n > 1;
      if (eventPhotosPrev) eventPhotosPrev.style.display = showNav ? "flex" : "none";
      if (eventPhotosNext) eventPhotosNext.style.display = showNav ? "flex" : "none";
    }

    if (photosBtn && eventPhotosModal && eventPhotosModalImg) {
      photosBtn.addEventListener("click", function () {
        if (!activeEvent || !activeEvent.gallery || activeEvent.gallery.length === 0) return;
        if (eventPhotosModalTitle) {
          eventPhotosModalTitle.textContent = (activeEvent.title || "Event") + " — photos";
        }
        eventPhotosUrls = activeEvent.gallery.slice();
        showEventPhotoAt(0);
        openModal("#eventPhotosModal");
      });
    }

    if (eventPhotosPrev) {
      eventPhotosPrev.addEventListener("click", function (e) {
        e.stopPropagation();
        showEventPhotoAt(eventPhotosIdx - 1);
      });
    }
    if (eventPhotosNext) {
      eventPhotosNext.addEventListener("click", function (e) {
        e.stopPropagation();
        showEventPhotoAt(eventPhotosIdx + 1);
      });
    }

    initBookEventForm();

    if (!Vara) {
      showEventsEmptyState();
    } else {
    Vara.public
      .getEvents()
      .then(function (result) {
        var raw = result.ok ? result.events : [];
        if (!Array.isArray(raw) || raw.length === 0) {
          showEventsEmptyState();
          return;
        }

        var events = raw.map(function (ev) {
          var desc = (ev.description || "").replace(/\s+/g, " ").trim();
          var firstSentence = desc;
          var secondSentence = "";
          var dotIdx = desc.indexOf(". ");
          if (dotIdx !== -1) {
            firstSentence = desc.slice(0, dotIdx + 1);
            secondSentence = desc.slice(dotIdx + 2);
          }

          function formatISODate(d) {
            return d ? new Date(d).toISOString().slice(0, 10) : "—";
          }

          var maxGuests =
            ev.maxPeopleAllowed != null ? ev.maxPeopleAllowed : "—";
          var enrolled =
            ev.curPeopleEnrolled != null ? ev.curPeopleEnrolled : 0;
          var pricePerPerson =
            ev.pricePerPerson != null ? ev.pricePerPerson : 0;
          var startLabel = ev.startDate ? formatISODate(ev.startDate) : "—";
          var endLabel = ev.endDate ? formatISODate(ev.endDate) : "—";

          var meta =
            "Max guests: " +
            maxGuests +
            "  --  enrolled: " +
            enrolled +
            "\n" +
            "Price per person: ₹" +
            pricePerPerson +
            "\n" +
            "Dates: " +
            startLabel +
            " - " +
            endLabel;

          var secondLine = (secondSentence ? secondSentence + "\n\n" : "") + meta;
          return {
            subtitle: "Upcoming Events",
            title: ev.name || "Event",
            eventId: ev.id,
            maxPeopleAllowed: ev.maxPeopleAllowed,
            curPeopleEnrolled: ev.curPeopleEnrolled,
            pricePerPerson: ev.pricePerPerson,
            startDate: ev.startDate,
            endDate: ev.endDate,
            lines: [firstSentence, secondLine],
            image:
              ev.banner ||
              "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&h=800&q=80",
            brochure: ev.brochure || null,
            gallery: Array.isArray(ev.gallery)
              ? ev.gallery.filter(function (u) {
                return u && String(u).trim();
              })
              : [],
          };
        });

        var idx = 0;
        var autoTimer = null;

        function showEvent(nextIdx) {
          idx = (nextIdx + events.length) % events.length;
          var ev = events[idx];
          activeEvent = ev;
          imgEl.style.opacity = "0";
          imgEl.style.filter = "blur(4px) scale(1.02)";
          setTimeout(function () {
            imgEl.style.backgroundImage = "url(" + ev.image + ")";
            imgEl.dataset.eventIdx = String(idx);
            imgEl.style.opacity = "1";
            imgEl.style.filter = "blur(0px) scale(1)";
          }, 140);

          subtitleEl.textContent = ev.subtitle;
          titleEl.textContent = ev.title;
          textEls.forEach(function (p, i) {
            if (ev.lines[i]) {
              p.textContent = ev.lines[i];
              p.style.display = "";
            } else {
              p.textContent = "";
              p.style.display = "none";
            }
          });

          if (brochureBtn) {
            if (ev.brochure) {
              brochureBtn.style.display = "";
              brochureBtn.href = ev.brochure;
            } else {
              brochureBtn.style.display = "none";
            }
          }
          if (photosBtn) {
            if (ev.gallery && ev.gallery.length > 0) {
              photosBtn.style.display = "";
            } else {
              photosBtn.style.display = "none";
            }
          }
        }

        function go(delta) {
          if (events.length <= 1) return;
          showEvent(idx + delta);
          restartAuto();
        }

        function restartAuto() {
          if (autoTimer) clearInterval(autoTimer);
          if (events.length <= 1) return;
          autoTimer = setInterval(function () {
            showEvent(idx + 1);
          }, 7000);
        }

        prevBtn.addEventListener("click", function () {
          go(-1);
        });
        nextBtn.addEventListener("click", function () {
          go(1);
        });

        if (events.length === 1) {
          prevBtn.style.display = "none";
          nextBtn.style.display = "none";
        }

        showEvent(0);
        restartAuto();
      })
      .catch(function () {
        // If events API fails, keep existing static copy visible
      });
    }
  })();

  // --- Hero slider (4 images, 5s) ---
  function setupHeroSlider() {
    const slides = Array.from(document.querySelectorAll(".hero__slide"));
    if (slides.length < 2) return;

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let idx = Math.max(
      0,
      slides.findIndex((s) => s.classList.contains("is-active")),
    );
    function show(nextIdx) {
      slides[idx].classList.remove("is-active");
      slides[nextIdx].classList.add("is-active");
      idx = nextIdx;
    }

    let timer = setInterval(() => {
      const next = (idx + 1) % slides.length;
      show(next);
    }, 5000);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        clearInterval(timer);
        timer = setInterval(() => {
          const next = (idx + 1) % slides.length;
          show(next);
        }, 5000);
      }
    });
  }

  // --- Blob cursor (site-wide) — single blob, small, transparent ---
  function setupBlobCursor() {
    const container = $("#blobCursor");
    const blob = container
      ? container.querySelector(".blob-cursor__blob")
      : null;
    if (!container || !blob) return;

    const isCoarse =
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;

    document.documentElement.classList.add("custom-cursor-active");
    document.body.classList.add("custom-cursor-active");

    let x = 0,
      y = 0;
    let rx = 0,
      ry = 0;
    const lerpRate = 0.36;
    let visible = false;
    let hovering = false;
    let down = false;
    let moving = false;
    let moveClear = null;
    let activeHoverEl = null;

    function setVisible(v) {
      visible = v;
      container.classList.toggle("is-visible", v);
      if (!v) container.classList.remove("is-over-dark-green");
    }

    function updateClasses() {
      container.classList.toggle("is-hover", hovering);
      container.classList.toggle("is-down", down);
    }

    window.addEventListener(
      "mousemove",
      (e) => {
        x = e.clientX;
        y = e.clientY;
        setVisible(true);
        moving = true;
        if (moveClear) clearTimeout(moveClear);
        moveClear = setTimeout(() => {
          moving = false;
        }, 100);
        var under = document.elementFromPoint(e.clientX, e.clientY);
        if (under) {
          var onGreen =
            !isOverHeader(under) &&
            under.closest &&
            under.closest(".hero, #about, .section.section--about");
          container.classList.toggle("is-over-dark-green", Boolean(onGreen));
        }
      },
      { passive: true },
    );

    window.addEventListener("mouseleave", () => setVisible(false));
    window.addEventListener("mousedown", () => {
      down = true;
      updateClasses();
    });
    window.addEventListener("mouseup", () => {
      down = false;
      updateClasses();
    });

    var textSelector =
      "h1, h2, h3, h4, h5, h6, p, .hero__title, .hero__subtitle, .hero__desc, .section__title, .section__subtitle";
    var hoverSelector =
      'a, button, .btn, input, textarea, [role="button"], .room-card, .gallery__item, .gallery-card, .events__nav, .gallery-reel__nav, .room-gallery__nav';
    var headerSelector = ".nav, .admin__header, .footer";
    function isOverHeader(el) {
      return el && el.closest && el.closest(headerSelector);
    }
    document.addEventListener("mouseover", (e) => {
      const target =
        e.target && e.target.closest && e.target.closest(hoverSelector);
      const textEl =
        e.target && e.target.closest && e.target.closest(textSelector);
      hovering = Boolean(target);
      container.classList.toggle("is-hover-text", Boolean(textEl));
      container.classList.toggle("is-over-header", isOverHeader(e.target));
      if (activeHoverEl && activeHoverEl !== target) {
        activeHoverEl.classList.remove("cursor-target");
      }
      activeHoverEl = target || null;
      if (activeHoverEl) {
        activeHoverEl.classList.add("cursor-target");
      }
      updateClasses();
    });

    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget) {
        hovering = false;
        container.classList.remove("is-hover-text");
        container.classList.remove("is-over-header");
        container.classList.remove("is-over-dark-green");
        if (activeHoverEl) activeHoverEl.classList.remove("cursor-target");
        activeHoverEl = null;
        updateClasses();
        return;
      }
      const stillHover =
        e.relatedTarget.closest && e.relatedTarget.closest(hoverSelector);
      const stillText =
        e.relatedTarget.closest && e.relatedTarget.closest(textSelector);
      hovering = Boolean(stillHover);
      container.classList.toggle("is-hover-text", Boolean(stillText));
      container.classList.toggle("is-over-header", isOverHeader(e.relatedTarget));
      if (!hovering && activeHoverEl) {
        activeHoverEl.classList.remove("cursor-target");
        activeHoverEl = null;
      }
      updateClasses();
    });

    function tick() {
      if (visible) {
        rx += (x - rx) * lerpRate;
        ry += (y - ry) * lerpRate;
        var scale = down ? 0.88 : hovering ? 1.22 : moving ? 1.06 : 1;
        blob.style.transform =
          "translate(" +
          rx +
          "px," +
          ry +
          "px) translate(-50%,-50%) scale(" +
          scale +
          ")";
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function setupChatbotWidget() {
    var floatBtn = $("#chatbotFloat");
    var messagesEl = $("#chatbotMessages");
    var inputEl = $("#chatbotInput");
    var sendBtn = $("#chatbotSendBtn");
    var windowEl = $("#chatbotWindow");
    var closeBtn = $("#chatbotCloseBtn");
    var composerEl = $("#chatbotComposer");
    var hintEl = $("#chatbotHint");

    var MSG_SIGNIN =
      "Welcome to Prathibhimba Stays! I'm Shruthi, your assistant. Please sign in to chat with me.";
    var MSG_WELCOME =
      "Welcome to Prathibhimba Stays! I'm Shruthi, your assistant. How can I assist you with your stay today?";

    if (!floatBtn || !messagesEl || !inputEl || !sendBtn || !windowEl) return;

    // Prevent Lenis / page smooth-scroll from hijacking scroll inside chatbot
    try {
      windowEl.setAttribute("data-lenis-prevent", "true");
      messagesEl.setAttribute("data-lenis-prevent", "true");
      inputEl.setAttribute("data-lenis-prevent", "true");
    } catch (_) { }

    var chatbotHistory = [];
    var isSending = false;
    var typingEl = null;

    function setTyping(isTyping) {
      if (!messagesEl) return;
      if (isTyping) {
        if (typingEl) return;
        typingEl = document.createElement("div");
        typingEl.className =
          "chatbot__bubble chatbot__bubble--model chatbot__bubble--typing";
        typingEl.textContent = "Typing...";
        messagesEl.appendChild(typingEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return;
      }
      if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
      typingEl = null;
    }

    function addBubble(text, role, extraClass) {
      var bubble = document.createElement("div");
      bubble.className =
        "chatbot__bubble " +
        (role === "user" ? "chatbot__bubble--user" : "chatbot__bubble--model");
      if (extraClass) bubble.classList.add(extraClass);
      // escapeHtml ensures no HTML injection; keep newlines readable
      var escaped = escapeHtml(String(text || ""));
      // Minimal markdown rendering:
      // - **bold**
      // - bullet lines starting with "* "
      escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      escaped = escaped.replace(/^\s*\*\s+/gm, "&#8226; ");
      bubble.innerHTML = escaped.replace(/\n/g, "<br>");
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function applyChatbotAuthUI() {
      if (!messagesEl || !windowEl) return;

      if (!currentUser) {
        chatbotHistory = [];
        messagesEl.innerHTML = "";
        addBubble(MSG_SIGNIN, "model", "chatbot__bubble--auth-prompt");
        if (composerEl) composerEl.style.display = "none";
        if (hintEl) hintEl.style.display = "none";
        if (inputEl) {
          inputEl.disabled = true;
          inputEl.value = "";
        }
        if (sendBtn) sendBtn.disabled = true;
        return;
      }

      if (composerEl) composerEl.style.display = "";
      if (hintEl) hintEl.style.display = "";
      if (inputEl) inputEl.disabled = false;
      if (sendBtn) sendBtn.disabled = false;

      var authPrompt = messagesEl.querySelector(".chatbot__bubble--auth-prompt");
      if (authPrompt) {
        messagesEl.innerHTML = "";
        addBubble(MSG_WELCOME, "model");
      } else if (messagesEl.childElementCount === 0) {
        addBubble(MSG_WELCOME, "model");
      }
    }

    refreshChatbotAuthUI = applyChatbotAuthUI;

    async function sendMessage() {
      if (isSending) return;
      if (!currentUser) return;
      if (!inputEl) return;
      var text = String(inputEl.value || "").trim();
      if (!text) return;

      isSending = true;
      try {
        inputEl.value = "";
        addBubble(text, "user");
        setTyping(true);

        var chatHeaders = { "Content-Type": "application/json" };
        var guestToken = getGuestToken();
        if (guestToken) chatHeaders["Authorization"] = "Bearer " + guestToken;

        var res = await fetch("/api/chat/chatbot", {
          method: "POST",
          credentials: "same-origin",
          headers: chatHeaders,
          body: JSON.stringify({
            message: text,
            history: chatbotHistory,
          }),
        });

        var data = await res.json().catch(function () {
          return {};
        });

        if (res.status === 401) {
          currentUser = null;
          updateAuthUI();
          applyChatbotAuthUI();
          return;
        }

        if (!res.ok) {
          var msg =
            data && data.text ? data.text : "Sorry, I couldn't reach the concierge right now.";
          throw new Error(msg);
        }

        var reply = data && data.text ? data.text : "";
        if (!reply) reply = "Sorry, I couldn't generate a response. Please try again.";

        // Preserve server-managed conversation history (best effort)
        if (Array.isArray(data.history)) chatbotHistory = data.history;

        setTyping(false);
        addBubble(reply, "model");
      } catch (err) {
        console.error("Chatbot frontend error:", err);
        setTyping(false);
        addBubble(
          "Sorry, something went wrong while getting that info. Please try again in a moment.",
          "model"
        );
      } finally {
        isSending = false;
      }
    }

    floatBtn.addEventListener("click", function () {
      var isOpen = windowEl.classList.toggle("is-open");
      if (isOpen) floatBtn.style.display = "none";
      else floatBtn.style.display = "";
      floatBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      windowEl.setAttribute("aria-hidden", isOpen ? "false" : "true");
      applyChatbotAuthUI();
      setTimeout(function () {
        try {
          if (currentUser && inputEl && !inputEl.disabled) inputEl.focus();
        } catch (_) { }
      }, 50);
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        windowEl.classList.remove("is-open");
        windowEl.setAttribute("aria-hidden", "true");
        floatBtn.setAttribute("aria-expanded", "false");
        floatBtn.style.display = "";
      });
    }

    // Native scroll inside chat messages only (no Lenis for chatbot).
    // Stop scroll from bubbling to the page, but do NOT preventDefault (keeps native scroll working).
    (function enableChatbotNativeScroll() {
      if (!messagesEl || !messagesEl.addEventListener) return;

      function isScrollable() {
        return messagesEl.scrollHeight > messagesEl.clientHeight + 1;
      }

      function shouldHandle(target) {
        try {
          if (!target) return false;
          if (target === inputEl || (target.closest && target.closest(".chatbot__composer"))) {
            return false;
          }
          return true;
        } catch (_) {
          return true;
        }
      }

      messagesEl.addEventListener(
        "wheel",
        function (e) {
          if (!shouldHandle(e.target)) return;
          if (!isScrollable()) return;
          e.stopPropagation();
        },
        { passive: true, capture: true }
      );
      messagesEl.addEventListener(
        "touchmove",
        function (e) {
          if (!shouldHandle(e.target)) return;
          if (!isScrollable()) return;
          e.stopPropagation();
        },
        { passive: true, capture: true }
      );
    })();

    sendBtn.addEventListener("click", function () {
      sendMessage();
    });

    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!windowEl.classList.contains("is-open")) return;
      windowEl.classList.remove("is-open");
      windowEl.setAttribute("aria-hidden", "true");
      floatBtn.setAttribute("aria-expanded", "false");
      floatBtn.style.display = "";
    });
  }

  // --- Init ---
  setupDirections();
  setupHeroSlider();
  setupBlobCursor();
  setupChatbotWidget();
  checkAuth(function (user) {
    if (user) {
      try {
        if (sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) === "cart") {
          sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
          window.location.href = "/cart";
        }
      } catch (_) { }
    }
  });
  renderRooms();

  function escapeAttrSiteGallery(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  var DEFAULT_SITE_GALLERY_URLS = [
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&h=600&q=80",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&h=600&q=80",
    "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=900&h=600&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=900&h=600&q=80",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&h=600&q=80",
    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&h=600&q=80",
  ];

  function renderSiteGalleryTrack(urls) {
    var track = document.getElementById("galleryReelTrack");
    if (!track || !urls || !urls.length) return;
    track.innerHTML = urls
      .map(function (url, i) {
        return (
          '<article class="gallery-reel__slide" data-gallery-idx="' +
          i +
          '" tabindex="0">' +
          '<div class="gallery-reel__img-wrap">' +
          '<img src="' +
          escapeAttrSiteGallery(url) +
          '" alt="Prathibhimba homestay photo ' +
          (i + 1) +
          '" />' +
          "</div></article>"
        );
      })
      .join("");
  }

  (function loadSiteGalleryReel() {
    var track = document.getElementById("galleryReelTrack");
    if (!track) return;
    if (!Vara) {
      renderSiteGalleryTrack(DEFAULT_SITE_GALLERY_URLS);
      if (typeof window.initGalleryReel === "function") window.initGalleryReel();
      return;
    }
    Vara.public
      .getSiteGallery()
      .then(function (result) {
        var urls =
          result.ok && result.images && result.images.length
            ? result.images
            : DEFAULT_SITE_GALLERY_URLS;
        renderSiteGalleryTrack(urls);
        if (typeof window.initGalleryReel === "function") window.initGalleryReel();
      })
      .catch(function () {
        renderSiteGalleryTrack(DEFAULT_SITE_GALLERY_URLS);
        if (typeof window.initGalleryReel === "function") window.initGalleryReel();
      });
  })();
})();
