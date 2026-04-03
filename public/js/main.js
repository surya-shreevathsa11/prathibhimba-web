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

  // --- Nav scroll + contrast by section (cream vs dark green) ---
  var navEl = $("#nav");
  if (navEl) {
    window.addEventListener("scroll", () => {
      navEl.classList.toggle("scrolled", window.scrollY > 60);
    });

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

  function checkDatesAvailability() {
    var checkIn = $("#bookRoomCheckIn") && $("#bookRoomCheckIn").value;
    var checkOut = $("#bookRoomCheckOut") && $("#bookRoomCheckOut").value;
    var availEl = $("#bookRoomAvailability");
    if (!availEl || !pendingBookRoom || !checkIn || !checkOut) {
      if (availEl) availEl.textContent = "";
      return;
    }
    var roomId = "R" + pendingBookRoom.id;
    availEl.textContent = "Checking availability…";
    availEl.classList.remove(
      "form__availability--ok",
      "form__availability--error",
    );
    fetch("/api/booking/checkAvailability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: roomId,
        checkIn: checkIn,
        checkOut: checkOut,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          availEl.textContent = "Rooms are available.";
          availEl.classList.add("form__availability--ok");
          availEl.classList.remove("form__availability--error");
        } else {
          availEl.textContent =
            result.data && result.data.message
              ? result.data.message
              : "Dates not available.";
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
      var roomId = "R" + pendingBookRoom.id;
      if (validRoomIdsFromBackend.length > 0 && validRoomIdsFromBackend.indexOf(roomId) === -1) {
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
        var availRes = await fetch("/api/booking/checkAvailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: roomId,
            checkIn: checkIn,
            checkOut: checkOut,
          }),
        });
        if (!availRes.ok) {
          var availData = await availRes.json().catch(function () {
            return {};
          });
          errEl.textContent =
            availData.message || "Selected dates are not available.";
          return;
        }
        var cartRes = await fetch("/api/booking/cart", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: roomId,
            checkIn: checkIn,
            checkOut: checkOut,
            adults: adults,
            children: children,
          }),
        });
        if (!cartRes.ok) {
          var cartData = await cartRes.json().catch(function () {
            return {};
          });
          errEl.textContent = cartData.message || "Could not add to cart.";
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
      fetch("/api/auth/logout", { method: "POST" }).then(() => {
        currentUser = null;
        updateAuthUI();
      });
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

      fetch("/api/booking/bookings", { credentials: "same-origin" })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            if (emptyEl) {
              emptyEl.textContent =
                result.data && result.data.message
                  ? result.data.message
                  : "Please sign in to view bookings.";
              emptyEl.style.display = "block";
            }
            fillMyBookingsModal([], []);
            openModal("#myBookingsModal");
            return;
          }
          var roomsBookings = result.data && result.data.data ? result.data.data : [];

          fetch("/api/booking/events/bookings", { credentials: "same-origin" })
            .then(function (res) {
              return res.json().then(function (data) {
                return { ok: res.ok, data: data };
              });
            })
            .then(function (eventsResult) {
              var eventBookings =
                eventsResult && eventsResult.ok && eventsResult.data
                  ? eventsResult.data.data || eventsResult.data
                  : [];
              fillMyBookingsModal(roomsBookings, Array.isArray(eventBookings) ? eventBookings : []);
              openModal("#myBookingsModal");
            })
            .catch(function () {
              fillMyBookingsModal(roomsBookings, []);
              openModal("#myBookingsModal");
            });
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
  $("#googleSignInBtn").addEventListener("click", () => {
    window.location.href = "/api/auth/google";
  });

  // --- Auth check: used before booking and for redirect after sign-in ---
  async function checkAuth(cb) {
    try {
      const res = await fetch("/api/auth/status", {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.loggedIn) {
        currentUser = data.user;
        updateAuthUI();
        fetchCartCount();
      } else {
        currentUser = null;
        updateAuthUI();
        const countEl = $("#navCartCount");
        if (countEl) {
          countEl.textContent = "0";
          countEl.setAttribute("data-count", "0");
        }
      }
      if (cb) cb(data.loggedIn ? data.user : null);
    } catch {
      if (cb) cb(null);
    }
  }

  async function fetchCartCount() {
    try {
      const res = await fetch("/api/booking/cart", {
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = await res.json();
      const count = Array.isArray(data.message) ? data.message.length : 0;
      const countEl = $("#navCartCount");
      if (countEl) {
        countEl.textContent = count;
        countEl.setAttribute("data-count", count);
      }
    } catch (_) {}
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
      return "Guest limits are not available. Please refresh the page.";
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
    var roomKey = "R" + roomId;
    var cap = roomsCapacityByRoomId[roomKey];
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
      const res = await fetch("/api/booking/rooms");
      const data = await res.json();
      if (!data.success || !Array.isArray(data.rooms)) return;
      validRoomIdsFromBackend = data.rooms.map(function (r) {
        return r.roomId || (r.id != null ? "R" + r.id : "");
      }).filter(Boolean);
      roomsCapacityByRoomId = {};
      data.rooms.forEach(function (r) {
        var rid = r.roomId || (r.id != null ? "R" + r.id : "");
        if (rid && r.capacity && typeof r.capacity === "object") {
          roomsCapacityByRoomId[rid] = r.capacity;
        }
      });
      const grid = $("#roomsGrid");
      grid.innerHTML = data.rooms
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
            return `
        <div class="room-card" data-reveal="slide-down" data-reveal-delay="${Math.min(idx * 100, 400)}"${roomImagesJson ? ' data-room-images="' + roomImagesJson.replace(/"/g, "&quot;") + '" data-room-name="' + (room.name || "").replace(/"/g, "&quot;") + '"' : ""}>
          <div class="room-card__media">
            <img loading="lazy" alt="${escapeHtml(room.name)} cover" src="${imgSrc}">
          </div>
          <span class="room-card__number">0${room.id}</span>
          <h3 class="room-card__name">${escapeHtml(room.name)}</h3>
          <p class="room-card__desc">${escapeHtml(room.description)}</p>
          <p class="room-card__price"><span>₹${room.price}</span> / night</p>
          <div class="room-card__actions">
            <button type="button" class="btn btn--outline btn--sm" data-add-cart="${room.id}" data-name="${escapeHtml(room.name)}" data-price="${room.price}">Add to cart</button>
          </div>
          <div class="room-card__overlay">
            <div class="room-card__overlay-inner">
              <h3 class="room-card__overlay-title">${escapeHtml(room.name)}</h3>
              <p class="room-card__overlay-desc">${escapeHtml(room.description)}</p>
              <p class="room-card__overlay-meta">From ₹${room.price} / night</p>
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
  function initRoomCardHover() {
    if (window.innerWidth <= 1024) return;
    document.querySelectorAll(".room-card").forEach(function (card) {
      var desc = card.querySelector(".room-card__desc");
      if (!desc) return;

      card.addEventListener("mouseenter", function () {
        card.classList.add("is-hovered");
        // Measure the full natural height and force it with highest CSS priority
        desc.style.setProperty("max-height", desc.scrollHeight + "px", "important");
        desc.style.setProperty("opacity", "1", "important");
        desc.style.setProperty("transform", "translateY(0)", "important");
        desc.style.setProperty("margin-bottom", "1rem", "important");
        desc.style.setProperty("overflow", "visible", "important");
      });
      card.addEventListener("mouseleave", function () {
        card.classList.remove("is-hovered");
        desc.style.setProperty("max-height", "0", "important");
        desc.style.setProperty("opacity", "0", "important");
        desc.style.setProperty("transform", "translateY(16px)", "important");
        desc.style.setProperty("margin-bottom", "0", "important");
        desc.style.setProperty("overflow", "hidden", "important");
      });
    });
  }

  window.initRoomCardHover = initRoomCardHover;

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
      if (!raw) return;
      var urls = [];
      try {
        urls = JSON.parse(raw);
      } catch (err) {}
      if (!urls.length) return;
      e.preventDefault();
      var name = card.getAttribute("data-room-name") || "";
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

        if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = true;

        fetch("/api/booking/events/checkout", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: pendingBookEvent.eventId,
            guest: {
              name: guestName,
              email: guestEmail,
              phone: guestPhone,
              guestCount: guestCount,
            },
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
              result.data.data.razorpayOrderId &&
              result.data.data.key
            ) {
              closeAllModals();

              if (!window.Razorpay) {
                alert("Razorpay checkout script not loaded. Please refresh and try again.");
                if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
                openBookEventModal(pendingBookEvent);
                return;
              }

              var bookingData = result.data.data;

              var options = {
                key: bookingData.key,
                amount: bookingData.totalAmount * 100,
                currency: "INR",
                order_id: bookingData.razorpayOrderId,
                name: "Prathibhimba",
                description: "Event Booking",
                prefill: {
                  name: guestName,
                  email: guestEmail,
                  contact: guestPhone,
                },
                handler: function (response) {
                  fetch("/api/payment/verify-event", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                    }),
                  })
                    .then(function (r) {
                      return r.json();
                    })
                    .then(function (data) {
                      if (data && data.success) {
                        if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
                      } else {
                        alert(
                          data && data.message
                            ? data.message
                            : "Payment verification failed. Please contact support."
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
            } else {
              if (bookEventSubmitBtn) bookEventSubmitBtn.disabled = false;
              if (bookEventErrorEl) {
                bookEventErrorEl.textContent =
                  (result.data && result.data.message) || "Could not create booking. Please try again.";
              }
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

    initBookEventForm();

    fetch("/api/events")
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var raw = (data && (data.data || data.events)) || [];
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
            eventId: ev._id || ev.id,
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
    const lerpRate = 0.42;
    let visible = false;
    let hovering = false;
    let down = false;
    let activeHoverEl = null;

    function setVisible(v) {
      visible = v;
      container.classList.toggle("is-visible", v);
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
      'a, button, .btn, input, textarea, [role="button"], .room-card, .gallery__item, .gallery-card, .events__nav, .gallery-reel__nav';
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
        var scale = down ? 0.9 : hovering ? 1.24 : 1;
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
    } catch (_) {}

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

        var res = await fetch("/api/chat/chatbot", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
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
      applyChatbotAuthUI();
      setTimeout(function () {
        try {
          if (currentUser && inputEl && !inputEl.disabled) inputEl.focus();
        } catch (_) {}
      }, 50);
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        windowEl.classList.remove("is-open");
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
      } catch (_) {}
    }
  });
  renderRooms();
})();
