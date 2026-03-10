(function () {
  "use strict";

  // ─── DOM refs ────────────────────────────────────────────────────────────────
  var viewLogin = document.getElementById("adminLogin");
  var viewOtp = document.getElementById("adminOtp");
  var viewDenied = document.getElementById("adminDenied");
  var viewDashboard = document.getElementById("adminDashboard");

  var adminLoginForm = document.getElementById("adminLoginForm");
  var adminUsername = document.getElementById("adminUsername");
  var adminPassword = document.getElementById("adminPassword");
  var adminPasswordToggle = document.getElementById("adminPasswordToggle");
  var adminLoginError = document.getElementById("adminLoginError");

  var adminOtpForm = document.getElementById("adminOtpForm");
  var adminOtpInput = document.getElementById("adminOtpInput");
  var adminOtpError = document.getElementById("adminOtpError");

  var adminRetryBtn = document.getElementById("adminRetryBtn");
  var adminLogoutBtn = document.getElementById("adminLogoutBtn");
  var adminHeaderSubtitle = document.getElementById("adminHeaderSubtitle");
  var adminHeaderUsername = document.getElementById("adminHeaderUsername");
  var statTotalBookings = document.getElementById("statTotalBookings");
  var statConfirmed = document.getElementById("statConfirmed");
  var statPending = document.getElementById("statPending");
  var statBlockedDates = document.getElementById("statBlockedDates");

  var basePriceGrid = document.getElementById("basePriceGrid");
  var saveBasePriceBtn = document.getElementById("saveBasePriceBtn");
  var basePriceMsg = document.getElementById("basePriceMsg");

  var addPricingRuleBtn = document.getElementById("addPricingRuleBtn");
  var addPricingRuleModal = document.getElementById("addPricingRuleModal");
  var addPricingRuleClose = document.getElementById("addPricingRuleClose");
  var addPricingRuleCancel = document.getElementById("addPricingRuleCancel");
  var addPricingRuleForm = document.getElementById("addPricingRuleForm");
  var pricingRulesBody = document.getElementById("pricingRulesBody");
  var pricingRulesEmpty = document.getElementById("pricingRulesEmpty");
  var pricingRulesTable = document.getElementById("pricingRulesTable");
  var pricingRuleMsg = document.getElementById("pricingRuleMsg");
  var ruleName = document.getElementById("ruleName");
  var ruleStartDate = document.getElementById("ruleStartDate");
  var ruleEndDate = document.getElementById("ruleEndDate");
  var ruleAppliesTo = document.getElementById("ruleAppliesTo");
  var ruleModifierType = document.getElementById("ruleModifierType");
  var ruleModifierValue = document.getElementById("ruleModifierValue");
  var rulePriority = document.getElementById("rulePriority");
  var rulePrioritySlider = document.getElementById("rulePrioritySlider");

  var bookingsBody = document.getElementById("bookingsBody");
  var bookingsEmpty = document.getElementById("bookingsEmpty");

  var blockDatesMsg = document.getElementById("blockDatesMsg");
  var blockRoom = document.getElementById("blockRoom");
  var blockFrom = document.getElementById("blockFrom");
  var blockTo = document.getElementById("blockTo");
  var blockReason = document.getElementById("blockReason");
  var addBlockDateBtn = document.getElementById("addBlockDateBtn");
  var blockDatesList = document.getElementById("blockDatesList");
  var blockDatesFilterRoom = document.getElementById("blockDatesFilterRoom");

  // ─── State ───────────────────────────────────────────────────────────────────
  var loggedInUsername = "";
  var seasonalPrices = [];
  var bookingsCache = [];
  var blockedDatesList = [];

  var roomList = [
    { id: "R1", name: "Sunflower" },
    { id: "R2", name: "Lily" },
    { id: "R3", name: "Marigold" },
    { id: "R4", name: "Lavender" },
    { id: "R5", name: "Dahlia" },
    { id: "R6", name: "Gardenia" },
    { id: "R7", name: "Petunia" },
    { id: "R8", name: "Zinnia" },
  ];

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function showView(id) {
    [viewLogin, viewOtp, viewDenied, viewDashboard].forEach(function (el) {
      if (el) el.style.display = el.id === id ? "block" : "none";
    });
    var body = document.body;
    if (body) {
      if (id === "adminDashboard") body.classList.add("admin--dashboard");
      else body.classList.remove("admin--dashboard");
    }
    if (adminLogoutBtn) {
      adminLogoutBtn.style.display = id === "adminDashboard" ? "" : "none";
    }
    if (adminHeaderSubtitle) {
      adminHeaderSubtitle.style.display = id === "adminDashboard" ? "" : "none";
    }
    if (adminHeaderUsername) {
      adminHeaderUsername.style.display = id === "adminDashboard" ? "" : "none";
      if (id === "adminDashboard") adminHeaderUsername.textContent = loggedInUsername || "";
    }
    if (id === "adminDashboard") refreshStats();
  }

  function refreshStats() {
    var total = bookingsCache.length;
    var confirmed = bookingsCache.filter(function (b) { return b.status === "confirmed"; }).length;
    var pending = bookingsCache.filter(function (b) { return b.status === "pending"; }).length;
    var blockedCount = blockedDatesList.length;
    if (statTotalBookings) statTotalBookings.textContent = total;
    if (statConfirmed) statConfirmed.textContent = confirmed;
    if (statPending) statPending.textContent = pending;
    if (statBlockedDates) statBlockedDates.textContent = blockedCount;
  }

  function switchTab(tabId) {
    var tabs = { bookings: "tabContentBookings", pricing: "tabContentPricing", blockdates: "tabContentBlockDates", images: "tabContentImages" };
    var contentId = tabs[tabId];
    if (!contentId) return;
    document.querySelectorAll(".admin__tab-btn").forEach(function (btn) {
      btn.classList.remove("active");
      btn.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".admin__tab-content").forEach(function (panel) {
      panel.classList.remove("active");
      panel.style.display = "none";
    });
    var btn = document.getElementById("tabBookings");
    if (tabId === "pricing") btn = document.getElementById("tabPricing");
    if (tabId === "blockdates") btn = document.getElementById("tabBlockDates");
    if (tabId === "images") btn = document.getElementById("tabRoomImages");
    if (btn) { btn.classList.add("active"); btn.setAttribute("aria-selected", "true"); }
    var panel = document.getElementById(contentId);
    if (panel) { panel.classList.add("active"); panel.style.display = "block"; }
    if (tabId === "images" && document.getElementById("imageRoom")) {
      loadRoomImages(document.getElementById("imageRoom").value);
    }
    if (tabId === "pricing") {
      loadPricingRules();
    }
    if (tabId === "blockdates") {
      loadBlockDates();
    }
  }

  function setMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text || "";
    el.className =
      "admin__msg " + (isError ? "admin__msg--error" : "admin__msg--success");
    el.style.display = text ? "block" : "none";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function apiPost(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {}
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function apiGet(url) {
    return fetch(url, { credentials: "include" }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    });
  }

  function apiPatch(url, body) {
    return fetch(url, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    });
  }

  function apiPut(url, body) {
    return fetch(url, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    });
  }

  function apiDelete(url) {
    return fetch(url, {
      method: "DELETE",
      credentials: "include",
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {}
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  var loginInProgress = false;
  function doLogin() {
    if (loginInProgress) return;
    var usernameEl = document.getElementById("adminUsername");
    var passwordEl = document.getElementById("adminPassword");
    var errEl = document.getElementById("adminLoginError");
    var username = usernameEl ? usernameEl.value.trim() : "";
    var password = passwordEl ? passwordEl.value : "";

    if (!username || !password) {
      setMsg(errEl, "Please enter username and password.", true);
      return;
    }

    setMsg(errEl, "");
    loginInProgress = true;

    apiPost("/api/admin/login", { username: username, password: password })
      .then(function (r) {
        loginInProgress = false;
        if (r.ok) {
          loggedInUsername = username;
          showView("adminOtp");
          var otpInput = document.getElementById("adminOtpInput");
          if (otpInput) {
            otpInput.value = "";
            otpInput.focus();
          }
        } else {
          setMsg(
            errEl,
            (r.data && r.data.message) || "Login failed.",
            true
          );
        }
      })
      .catch(function () {
        loginInProgress = false;
        setMsg(document.getElementById("adminLoginError"), "Network error. Please try again.", true);
      });
  }

  function doVerifyOtp() {
    var otpEl = document.getElementById("adminOtpInput");
    var errEl = document.getElementById("adminOtpError");
    var otp = otpEl ? otpEl.value.trim() : "";

    if (!otp) {
      setMsg(errEl, "Please enter the OTP.", true);
      return;
    }
    if (!loggedInUsername) {
      setMsg(errEl, "Session expired. Please sign in again.", true);
      showView("adminLogin");
      return;
    }

    setMsg(errEl, "");

    apiPost("/api/admin/verify-otp", { username: loggedInUsername, otp: otp })
      .then(function (r) {
        if (r.ok) {
          showView("adminDashboard");
          renderBasePrices();
          loadBlockDates();
          loadBookings();
        } else {
          setMsg(
            errEl,
            (r.data && r.data.message) || "Invalid OTP.",
            true
          );
        }
      })
      .catch(function () {
        setMsg(document.getElementById("adminOtpError"), "Network error. Please try again.", true);
      });
  }

  function renderSeasonal() {
    /* no-op: pricing rules UI replaced seasonal list; kept for init compatibility */
  }

  // ─── Base prices ─────────────────────────────────────────────────────────────
  function renderBasePrices() {
    if (!basePriceGrid) return;
    basePriceGrid.innerHTML = roomList
      .map(function (r) {
        return (
          '<div class="admin__price-row">' +
          '<label for="bp-' +
          r.id +
          '">' +
          r.name +
          ' <span class="admin__room-id">(' +
          r.id +
          ")</span></label>" +
          '<input type="number" id="bp-' +
          r.id +
          '" data-room="' +
          r.id +
          '" min="0" step="1" value="0" placeholder="0">' +
          "</div>"
        );
      })
      .join("");
  }

  if (saveBasePriceBtn) {
    saveBasePriceBtn.addEventListener("click", function () {
      var payload = roomList.map(function (r) {
        var input = document.getElementById("bp-" + r.id);
        return {
          roomId: r.id,
          pricePerNight: input ? Number(input.value) || 0 : 0,
        };
      });

      apiPut("/api/admin/base-price", { rooms: payload })
        .then(function (r) {
          if (r.ok) {
            setMsg(basePriceMsg, "Base prices updated successfully.", false);
          } else {
            setMsg(
              basePriceMsg,
              (r.data && r.data.message) || "Failed to save.",
              true
            );
          }
        })
        .catch(function () {
          setMsg(basePriceMsg, "Network error. Could not save.", true);
        });
    });
  }

  // ─── Pricing Rules (anudinakuteera-style) ─────────────────────────────────────
  function loadPricingRules() {
    apiGet("/api/admin/seasonal-price")
      .then(function (r) {
        seasonalPrices = (r.data && r.data.data) || [];
        renderPricingRulesTable();
      })
      .catch(function () {
        seasonalPrices = [];
        renderPricingRulesTable();
      });
  }

  function renderPricingRulesTable() {
    if (!pricingRulesBody || !pricingRulesEmpty || !pricingRulesTable) return;
    if (seasonalPrices.length === 0) {
      pricingRulesTable.style.display = "none";
      pricingRulesEmpty.style.display = "block";
      return;
    }
    pricingRulesEmpty.style.display = "none";
    pricingRulesTable.style.display = "table";
    var fromStr = function (d) {
      if (!d) return "—";
      var x = typeof d === "string" ? d : (d.toISOString ? d.toISOString().slice(0, 10) : "");
      return x;
    };
    pricingRulesBody.innerHTML = seasonalPrices
      .map(function (rule) {
        var id = rule._id || rule.id;
        var from = fromStr(rule.from);
        var to = fromStr(rule.to);
        var roomName = roomList.find(function (r) { return r.id === rule.roomId; });
        var appliesTo = roomName ? rule.roomId + " — " + roomName.name : rule.roomId;
        return (
          "<tr>" +
          "<td>" + (rule.reason || "—") + "</td>" +
          "<td>" + appliesTo + "</td>" +
          "<td>" + from + " – " + to + "</td>" +
          "<td>₹" + (rule.pricePerNight != null ? rule.pricePerNight : "—") + " / night</td>" +
          "<td>—</td>" +
          "<td>0</td>" +
          "<td>Active</td>" +
          '<td><button type="button" class="btn btn--ghost btn--sm admin__rule-remove" data-rule-id="' + (id || "") + '">Remove</button></td>' +
          "</tr>"
        );
      })
      .join("");

    pricingRulesBody.querySelectorAll(".admin__rule-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ruleId = btn.getAttribute("data-rule-id");
        if (!ruleId) return;
        apiDelete("/api/admin/seasonal-price/" + ruleId)
          .then(function (res) {
            if (res.ok) loadPricingRules();
          })
          .catch(function () { loadPricingRules(); });
      });
    });
  }

  function openPricingRuleModal() {
    if (addPricingRuleModal) {
      addPricingRuleModal.style.display = "flex";
      addPricingRuleModal.setAttribute("aria-hidden", "false");
    }
  }

  function closePricingRuleModal() {
    if (addPricingRuleModal) {
      addPricingRuleModal.style.display = "none";
      addPricingRuleModal.setAttribute("aria-hidden", "true");
    }
  }

  if (addPricingRuleBtn) {
    addPricingRuleBtn.addEventListener("click", openPricingRuleModal);
  }
  if (addPricingRuleClose) {
    addPricingRuleClose.addEventListener("click", closePricingRuleModal);
  }
  if (addPricingRuleCancel) {
    addPricingRuleCancel.addEventListener("click", closePricingRuleModal);
  }
  if (addPricingRuleModal) {
    addPricingRuleModal.addEventListener("click", function (e) {
      if (e.target === addPricingRuleModal) closePricingRuleModal();
    });
  }

  if (rulePriority && rulePrioritySlider) {
    rulePrioritySlider.addEventListener("input", function () {
      rulePriority.value = rulePrioritySlider.value;
    });
    rulePriority.addEventListener("input", function () {
      var v = parseInt(rulePriority.value, 10);
      if (!isNaN(v)) rulePrioritySlider.value = Math.min(10, Math.max(0, v));
    });
  }

  if (addPricingRuleForm) {
    addPricingRuleForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameVal = ruleName ? ruleName.value.trim() : "";
      var startVal = ruleStartDate ? ruleStartDate.value : "";
      var endVal = ruleEndDate ? ruleEndDate.value : "";
      var appliesVal = ruleAppliesTo ? ruleAppliesTo.value : "R1";
      var modType = ruleModifierType ? ruleModifierType.value : "fixed";
      var modVal = ruleModifierValue ? Number(ruleModifierValue.value) : 0;

      var formMsg = document.getElementById("addRuleFormMsg");
      if (!nameVal) {
        setMsg(formMsg, "Rule name is required.", true);
        if (formMsg) formMsg.style.display = "block";
        return;
      }
      if (!startVal || !endVal) {
        setMsg(formMsg, "Start and end dates are required.", true);
        if (formMsg) formMsg.style.display = "block";
        return;
      }
      if (startVal >= endVal) {
        setMsg(formMsg, "Start date must be before end date.", true);
        if (formMsg) formMsg.style.display = "block";
        return;
      }
      var pricePerNight = modType === "percentage" ? 0 : modVal;
      if (pricePerNight <= 0 && modType === "fixed") {
        setMsg(formMsg, "Please enter a valid price.", true);
        if (formMsg) formMsg.style.display = "block";
        return;
      }
      if (modType === "percentage") {
        setMsg(formMsg, "Percentage modifier is not supported yet. Use Fixed price.", true);
        if (formMsg) formMsg.style.display = "block";
        return;
      }

      var payload = {
        roomId: appliesVal,
        reason: nameVal,
        from: startVal,
        to: endVal,
        pricePerNight: pricePerNight,
      };

      setMsg(formMsg, "", false);
      apiPost("/api/admin/seasonal-price", payload)
        .then(function (r) {
          if (r.ok) {
            closePricingRuleModal();
            loadPricingRules();
            addPricingRuleForm.reset();
            if (rulePriority) rulePriority.value = "0";
            if (rulePrioritySlider) rulePrioritySlider.value = "0";
          } else {
            setMsg(formMsg, (r.data && r.data.message) || "Failed to add rule.", true);
            if (formMsg) formMsg.style.display = "block";
          }
        })
        .catch(function () {
          setMsg(formMsg, "Network error. Could not add rule.", true);
          if (formMsg) formMsg.style.display = "block";
        });
    });
  }

  // ─── Block dates ─────────────────────────────────────────────────────────────
  function loadBlockDates() {
    apiGet("/api/admin/block-dates")
      .then(function (r) {
        blockedDatesList = (r.data && r.data.data) || [];
        renderBlockDates();
        refreshStats();
      })
      .catch(function () {
        blockedDatesList = [];
        renderBlockDates();
        refreshStats();
      });
  }

  function renderBlockDates() {
    if (!blockDatesList) return;
    var filterRoom = blockDatesFilterRoom ? blockDatesFilterRoom.value : "";
    var list = filterRoom
      ? blockedDatesList.filter(function (b) { return (b.roomId || "") === filterRoom; })
      : blockedDatesList;

    if (list.length === 0) {
      blockDatesList.innerHTML =
        '<p class="admin__empty admin__blocked-empty">' +
        (blockedDatesList.length === 0
          ? "No blocked dates. Add a block to make a room unavailable for specific dates."
          : "No blocked dates for the selected room.") +
        "</p>";
      return;
    }

    blockDatesList.innerHTML = list
      .map(function (b) {
        var fromStr = b.from ? b.from.toString().slice(0, 10) : "";
        var toStr = b.to ? b.to.toString().slice(0, 10) : "";
        var id = (b._id || b.id || "").toString();
        var roomName = roomList.find(function (r) { return r.id === b.roomId; });
        var roomLabel = roomName ? b.roomId + " — " + roomName.name : b.roomId;
        return (
          '<div class="admin__blocked-item">' +
          '<span class="admin__blocked-item-text">' + roomLabel + " · " + fromStr + " – " + toStr + "</span>" +
          '<button type="button" class="btn admin__btn-remove-block" data-block-id="' + escapeHtml(id) + '">Remove</button>' +
          "</div>"
        );
      })
      .join("");

    blockDatesList.querySelectorAll("[data-block-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-block-id");
        if (!id) return;
        apiDelete("/api/admin/block-dates/" + id).then(function (r) {
          if (r.ok) {
            blockedDatesList = blockedDatesList.filter(
              function (b) { return (b._id || b.id || "").toString() !== id; }
            );
            renderBlockDates();
            refreshStats();
            setMsg(blockDatesMsg, "Block removed.", false);
          } else {
            setMsg(blockDatesMsg, (r.data && r.data.message) || "Failed to remove block.", true);
          }
        });
      });
    });
  }

  if (blockDatesFilterRoom) {
    blockDatesFilterRoom.addEventListener("change", function () {
      renderBlockDates();
    });
  }

  if (addBlockDateBtn) {
    addBlockDateBtn.addEventListener("click", function () {
      var fromVal = blockFrom ? blockFrom.value : "";
      var toVal = blockTo ? blockTo.value : "";

      if (!fromVal || !toVal) {
        setMsg(blockDatesMsg, "Please set from and to dates.", true);
        return;
      }
      if (fromVal >= toVal) {
        setMsg(blockDatesMsg, "From date must be before to date.", true);
        return;
      }

      var payload = {
        roomId: blockRoom ? blockRoom.value : "R1",
        from: fromVal,
        to: toVal,
      };

      apiPost("/api/admin/block-dates", payload)
        .then(function (r) {
          if (r.ok && r.data && r.data.data) {
            blockedDatesList.push(r.data.data);
            renderBlockDates();
            refreshStats();
            setMsg(blockDatesMsg, "Dates blocked successfully.", false);
            if (blockFrom) blockFrom.value = "";
            if (blockTo) blockTo.value = "";
            if (blockReason) blockReason.value = "";
          } else {
            setMsg(
              blockDatesMsg,
              (r.data && r.data.message) || "Failed to add block.",
              true
            );
          }
        })
        .catch(function () {
          setMsg(blockDatesMsg, "Network error. Could not add block.", true);
        });
    });
  }

  // ─── Bookings ─────────────────────────────────────────────────────────────────
  var applyFilterBtn = document.getElementById("applyFilterBtn");
  var clearFilterBtn = document.getElementById("clearFilterBtn");
  var filterStatus = document.getElementById("filterStatus");
  var filterUpcoming = document.getElementById("filterUpcoming");

  function buildBookingsUrl() {
    var params = [];
    var status = filterStatus ? filterStatus.value : "";
    var upcoming = filterUpcoming ? filterUpcoming.value : "";
    if (status) params.push("status=" + encodeURIComponent(status));
    if (upcoming) params.push("upcoming=" + encodeURIComponent(upcoming));
    return (
      "/api/admin/bookings" + (params.length ? "?" + params.join("&") : "")
    );
  }

  function loadBookings() {
    if (bookingsBody)
      bookingsBody.innerHTML =
        "<tr><td colspan='9' style='text-align:center;padding:1.5rem;color:#a89878;'>Loading…</td></tr>";
    if (bookingsEmpty) bookingsEmpty.style.display = "none";

    var statusFilter = filterStatus ? filterStatus.value : "";
    if (statusFilter === "blocked") {
      apiGet("/api/admin/block-dates")
        .then(function (r) {
          var list = (r.data && r.data.data) || [];
          blockedDatesList = list;
          renderBlockedDatesInBookingsTable(list);
          refreshStats();
        })
        .catch(function () {
          if (bookingsEmpty) {
            bookingsEmpty.querySelector("p").textContent = "Could not load blocked dates.";
            bookingsEmpty.style.display = "block";
          }
          if (bookingsBody) bookingsBody.innerHTML = "";
        });
      return;
    }

    apiGet(buildBookingsUrl())
      .then(function (r) {
        var list = (r.data && r.data.data) || [];
        bookingsCache = list;
        renderBookingsTable(list);
        refreshStats();
      })
      .catch(function () {
        if (bookingsEmpty) {
          bookingsEmpty.querySelector("p").textContent = "Could not load bookings.";
          bookingsEmpty.style.display = "block";
        }
        if (bookingsBody) bookingsBody.innerHTML = "";
      });
  }

  function renderBlockedDatesInBookingsTable(blockedList) {
    if (!bookingsBody) return;
    if (blockedList.length === 0) {
      if (bookingsEmpty) {
        bookingsEmpty.querySelector("p").textContent = "No blocked dates.";
        if (bookingsEmpty.querySelector(".admin__empty-hint"))
          bookingsEmpty.querySelector(".admin__empty-hint").textContent = "Block dates from the Block Dates tab.";
        bookingsEmpty.style.display = "block";
      }
      bookingsBody.innerHTML = "";
      return;
    }
    if (bookingsEmpty) bookingsEmpty.style.display = "none";

    bookingsBody.innerHTML = blockedList
      .map(function (b) {
        var fromStr = b.from ? b.from.toString().slice(0, 10) : "";
        var toStr = b.to ? b.to.toString().slice(0, 10) : "";
        var id = (b._id || b.id || "").toString();
        var roomName = roomList.find(function (r) { return r.id === b.roomId; });
        var roomsSummary = roomName ? b.roomId + " — " + roomName.name : (b.roomId || "—");
        return (
          "<tr data-block-id='" + escapeHtml(id) + "'>" +
          "<td><span class='admin__guest-name'>Blocked</span></td>" +
          "<td>—</td>" +
          "<td>" + escapeHtml(roomsSummary) + "</td>" +
          "<td>—</td>" +
          "<td>" + escapeHtml(fromStr) + "</td>" +
          "<td>" + escapeHtml(toStr) + "</td>" +
          "<td>—</td>" +
          "<td class='admin__status-cell'><span class='admin__badge admin__badge--blocked'>Blocked</span></td>" +
          "<td class='admin__edit-cell'>" +
          "<button type='button' class='btn admin__btn-unblock' data-block-id='" + escapeHtml(id) + "'>Unblock</button>" +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    bookingsBody.querySelectorAll(".admin__btn-unblock").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-block-id");
        if (!id) return;
        apiDelete("/api/admin/block-dates/" + id).then(function (r) {
          if (r.ok) {
            loadBookings();
            refreshStats();
          }
        });
      });
    });
  }

  if (applyFilterBtn) applyFilterBtn.addEventListener("click", loadBookings);

  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", function () {
      if (filterStatus) filterStatus.value = "";
      if (filterUpcoming) filterUpcoming.value = "";
      loadBookings();
    });
  }

  [["tabBookings", "bookings"], ["tabPricing", "pricing"], ["tabBlockDates", "blockdates"], ["tabRoomImages", "images"]].forEach(function (pair) {
    var btn = document.getElementById(pair[0]);
    if (btn) btn.addEventListener("click", function () { switchTab(pair[1]); });
  });

  function openCloudinaryUpload(roomId, type) {
    if (typeof cloudinary === "undefined") {
      setMsg(document.getElementById("roomImagesMsg"), "Cloudinary widget is loading. Try again in a moment.", true);
      return;
    }
    apiGet("/api/admin/cloud-signature").then(function (r) {
      if (!r.ok || !r.data) {
        setMsg(document.getElementById("roomImagesMsg"), "Could not get upload signature.", true);
        return;
      }
      var d = r.data;
      var widget = cloudinary.createUploadWidget(
        {
          cloudName: d.cloudName,
          apiKey: d.apiKey,
          uploadSignature: d.signature,
          uploadSignatureTimestamp: d.timestamp,
          folder: d.folder,
          sources: ["local", "camera"],
          multiple: type === "gallery",
        },
        function (error, result) {
          if (error) return;
          if (result.event === "success") {
            var url = result.info && result.info.secure_url;
            if (!url) return;
            if (type === "banner") {
              apiPatch("/api/admin/rooms/" + roomId + "/images", { banner: url }).then(function (res) {
                setMsg(document.getElementById("roomImagesMsg"), res.ok ? "Banner updated." : (res.data && res.data.message) || "Update failed.", !res.ok);
                if (res.ok && res.data && res.data.data) renderRoomImagesStrip(res.data.data);
              });
            } else {
              apiPatch("/api/admin/rooms/" + roomId + "/images/gallery/add", { url: url }).then(function (res) {
                setMsg(document.getElementById("roomImagesMsg"), res.ok ? "Image added to gallery." : (res.data && res.data.message) || "Add failed.", !res.ok);
                if (res.ok && res.data && res.data.data) renderRoomImagesStrip(res.data.data);
              });
            }
          }
        }
      );
      widget.open();
    }).catch(function () {
      setMsg(document.getElementById("roomImagesMsg"), "Could not get upload signature.", true);
    });
  }

  var imageRoomSelect = document.getElementById("imageRoom");
  var uploadBannerBtn = document.getElementById("uploadBannerBtn");
  var uploadGalleryBtn = document.getElementById("uploadGalleryBtn");
  var roomImagesStrip = document.getElementById("roomImagesStrip");
  var roomImagesViewerWrap = document.getElementById("roomImagesViewerWrap");
  var roomImagesEmptyWrap = document.getElementById("roomImagesEmptyWrap");
  var roomImagesFileListWrap = document.getElementById("roomImagesFileListWrap");
  var roomImagesFileBody = document.getElementById("roomImagesFileBody");
  var roomImagesCurrentImg = document.getElementById("roomImagesCurrentImg");
  var roomImagesLabel = document.getElementById("roomImagesLabel");
  var roomImagesCounter = document.getElementById("roomImagesCounter");
  var roomImagesPrev = document.getElementById("roomImagesPrev");
  var roomImagesNext = document.getElementById("roomImagesNext");
  var roomImagesDeleteBtn = document.getElementById("roomImagesDeleteBtn");

  var roomImagesList = [];
  var roomImagesIndex = 0;

  function toJpegUrl(url) {
    if (!url || typeof url !== "string") return url;
    if (url.indexOf("cloudinary.com") !== -1 && url.indexOf("/upload/") !== -1) {
      return url.replace("/upload/", "/upload/f_jpg/");
    }
    return url;
  }

  function updateRoomImageView() {
    if (!roomImagesList.length || !roomImagesCurrentImg) return;
    var idx = roomImagesIndex;
    if (idx < 0) idx = 0;
    if (idx >= roomImagesList.length) idx = roomImagesList.length - 1;
    roomImagesIndex = idx;
    var item = roomImagesList[roomImagesIndex];
    roomImagesCurrentImg.src = toJpegUrl(item.url);
    roomImagesCurrentImg.alt = item.label;
    if (roomImagesLabel) roomImagesLabel.textContent = item.label;
    if (roomImagesCounter) {
      roomImagesCounter.textContent = roomImagesList.length > 1
        ? (roomImagesIndex + 1) + " / " + roomImagesList.length
        : "1 / 1";
    }
    if (roomImagesPrev) roomImagesPrev.style.visibility = roomImagesList.length > 1 ? "visible" : "hidden";
    if (roomImagesNext) roomImagesNext.style.visibility = roomImagesList.length > 1 ? "visible" : "hidden";
    if (roomImagesFileBody) {
      roomImagesFileBody.querySelectorAll(".room-images__file-row").forEach(function (row, i) {
        row.classList.toggle("room-images__file-row--active", i === roomImagesIndex);
      });
    }
  }

  function renderRoomImagesFileList() {
    if (!roomImagesFileBody || !roomImagesList.length) return;
    var roomId = imageRoomSelect ? imageRoomSelect.value : "";
    roomImagesFileBody.innerHTML = roomImagesList.map(function (item, idx) {
      var safeUrl = toJpegUrl(item.url).replace(/"/g, "&quot;");
      var safeLabel = item.label.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      var activeClass = idx === roomImagesIndex ? " room-images__file-row--active" : "";
      return (
        "<tr class=\"room-images__file-row" + activeClass + "\" data-index=\"" + idx + "\" role=\"row\">" +
        "<td class=\"room-images__file-preview\"><img src=\"" + safeUrl + "\" alt=\"\" class=\"room-images__file-thumb\" loading=\"lazy\" /></td>" +
        "<td class=\"room-images__file-name\">" + safeLabel + "</td>" +
        "<td class=\"room-images__file-type\">JPEG</td>" +
        "<td class=\"room-images__file-actions\">" +
        "<button type=\"button\" class=\"room-images__file-delete btn btn--ghost btn--sm\" data-index=\"" + idx + "\" aria-label=\"Delete " + safeLabel + "\">Delete</button>" +
        "</td></tr>"
      );
    }).join("");
    roomImagesFileBody.querySelectorAll(".room-images__file-row").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest(".room-images__file-delete")) return;
        var idx = parseInt(row.getAttribute("data-index"), 10);
        if (!isNaN(idx) && idx >= 0 && idx < roomImagesList.length) {
          roomImagesIndex = idx;
          updateRoomImageView();
        }
      });
    });
    roomImagesFileBody.querySelectorAll(".room-images__file-delete").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.getAttribute("data-index"), 10);
        if (isNaN(idx) || idx < 0 || idx >= roomImagesList.length) return;
        var item = roomImagesList[idx];
        var req = item.isBanner
          ? apiPatch("/api/admin/rooms/" + roomId + "/images", { banner: null })
          : apiPatch("/api/admin/rooms/" + roomId + "/images/gallery/remove", { url: item.url });
        req.then(function (res) {
          if (res.ok && res.data && res.data.data) {
            renderRoomImagesStrip(res.data.data);
          } else {
            loadRoomImages(roomId);
          }
        }).catch(function () {
          loadRoomImages(roomId);
        });
      });
    });
  }

  function renderRoomImagesStrip(images) {
    if (!imageRoomSelect || !roomImagesStrip) return;
    var roomId = imageRoomSelect.value;
    var list = [];
    if (images && images.banner) list.push(images.banner);
    if (images && images.gallery && images.gallery.length) list = list.concat(images.gallery);
    if (list.length === 0) {
      if (roomImagesViewerWrap) roomImagesViewerWrap.style.display = "none";
      if (roomImagesFileListWrap) roomImagesFileListWrap.style.display = "none";
      if (roomImagesEmptyWrap) roomImagesEmptyWrap.style.display = "block";
      roomImagesStrip.innerHTML = "<p class=\"room-images__empty\">No images for this room yet. Upload a banner or add to gallery.</p>";
      return;
    }
    var bannerUrl = images && images.banner ? images.banner : null;
    roomImagesList = list.map(function (url, idx) {
      var isBanner = url === bannerUrl;
      var label = isBanner ? "Banner" : "Gallery " + (idx - (bannerUrl ? 1 : 0) + 1);
      return { url: url, isBanner: isBanner, label: label };
    });
    roomImagesIndex = 0;
    if (roomImagesFileListWrap) roomImagesFileListWrap.style.display = "block";
    if (roomImagesViewerWrap) roomImagesViewerWrap.style.display = "block";
    if (roomImagesEmptyWrap) roomImagesEmptyWrap.style.display = "none";
    renderRoomImagesFileList();
    updateRoomImageView();
  }

  if (roomImagesPrev) {
    roomImagesPrev.addEventListener("click", function () {
      if (roomImagesList.length <= 1) return;
      roomImagesIndex = (roomImagesIndex - 1 + roomImagesList.length) % roomImagesList.length;
      updateRoomImageView();
    });
  }
  if (roomImagesNext) {
    roomImagesNext.addEventListener("click", function () {
      if (roomImagesList.length <= 1) return;
      roomImagesIndex = (roomImagesIndex + 1) % roomImagesList.length;
      updateRoomImageView();
    });
  }
  if (roomImagesDeleteBtn && imageRoomSelect) {
    roomImagesDeleteBtn.addEventListener("click", function () {
      if (!roomImagesList.length) return;
      var roomId = imageRoomSelect.value;
      var item = roomImagesList[roomImagesIndex];
      var req = item.isBanner
        ? apiPatch("/api/admin/rooms/" + roomId + "/images", { banner: null })
        : apiPatch("/api/admin/rooms/" + roomId + "/images/gallery/remove", { url: item.url });
      req.then(function (res) {
        if (res.ok && res.data && res.data.data) {
          renderRoomImagesStrip(res.data.data);
        } else {
          loadRoomImages(roomId);
        }
      }).catch(function () {
        loadRoomImages(roomId);
      });
    });
  }

  function loadRoomImages(roomId) {
    if (!roomId || !roomImagesStrip) return;
    if (roomImagesViewerWrap) roomImagesViewerWrap.style.display = "none";
    if (roomImagesFileListWrap) roomImagesFileListWrap.style.display = "none";
    if (roomImagesEmptyWrap) roomImagesEmptyWrap.style.display = "block";
    roomImagesStrip.innerHTML = "<p class=\"room-images__loading\">Loading…</p>";
    apiGet("/api/admin/rooms/" + roomId).then(function (r) {
      if (r.ok && r.data && r.data.images) {
        renderRoomImagesStrip(r.data.images);
      } else {
        roomImagesStrip.innerHTML = "<p class=\"room-images__empty\">Could not load images.</p>";
      }
    }).catch(function () {
      if (roomImagesStrip) roomImagesStrip.innerHTML = "<p class=\"room-images__empty\">Could not load images.</p>";
    });
  }

  if (imageRoomSelect) {
    imageRoomSelect.addEventListener("change", function () {
      loadRoomImages(imageRoomSelect.value);
    });
  }

  if (uploadBannerBtn && imageRoomSelect) {
    uploadBannerBtn.addEventListener("click", function () {
      openCloudinaryUpload(imageRoomSelect.value, "banner");
    });
  }
  if (uploadGalleryBtn && imageRoomSelect) {
    uploadGalleryBtn.addEventListener("click", function () {
      openCloudinaryUpload(imageRoomSelect.value, "gallery");
    });
  }

  function renderBookingsTable(list) {
    if (!bookingsBody) return;

    if (list.length === 0) {
      if (bookingsEmpty) bookingsEmpty.style.display = "block";
      bookingsBody.innerHTML = "";
      return;
    }

    if (bookingsEmpty) bookingsEmpty.style.display = "none";

    var statusBadgeClass = {
      confirmed: "admin__badge--confirmed",
      pending: "admin__badge--pending",
      cancelled: "admin__badge--cancelled",
      blocked: "admin__badge--blocked",
    };

    bookingsBody.innerHTML = list
      .map(function (b) {
        var rooms = b.rooms || [];
        var roomsSummary = rooms
          .map(function (r) {
            return r.roomName || r.roomId || "—";
          })
          .join(", ");
        var totalAdults = rooms.reduce(function (sum, r) { return sum + (r.adults || 0); }, 0);
        var totalKids = rooms.reduce(function (sum, r) { return sum + (r.children || 0); }, 0);
        var guestsText = totalAdults || totalKids ? (totalAdults + "A" + (totalKids ? ", " + totalKids + "K" : "")) : "—";
        var checkIns = rooms
          .map(function (r) {
            return formatDate(r.checkIn);
          })
          .join("<br>");
        var checkOuts = rooms
          .map(function (r) {
            return formatDate(r.checkOut);
          })
          .join("<br>");
        var id = escapeHtml(b._id || b.id || "");
        var currentStatus = b.status || "pending";
        var badgeClass = statusBadgeClass[currentStatus] || "";

        var statusOptions = ["pending", "confirmed", "cancelled", "blocked"]
          .map(function (s) {
            return (
              '<option value="' +
              s +
              '"' +
              (s === currentStatus ? " selected" : "") +
              ">" +
              s.charAt(0).toUpperCase() +
              s.slice(1) +
              "</option>"
            );
          })
          .join("");

        return (
          "<tr data-booking-id='" +
          id +
          "'>" +
          "<td>" +
          "<span class='admin__guest-name'>" +
          escapeHtml((b.guest && b.guest.name) || "—") +
          "</span><br><small>" +
          escapeHtml((b.guest && b.guest.email) || "") +
          "</small></td>" +
          "<td>" +
          escapeHtml((b.guest && b.guest.phone) || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(roomsSummary) +
          "</td>" +
          "<td>" +
          escapeHtml(guestsText) +
          "</td>" +
          "<td>" +
          checkIns +
          "</td>" +
          "<td>" +
          checkOuts +
          "</td>" +
          "<td>₹" +
          (b.totalAmount || 0).toLocaleString("en-IN") +
          "<br><small class='admin__paid'>Paid: ₹" +
          (b.amountPaid || 0).toLocaleString("en-IN") +
          "</small></td>" +
          "<td class='admin__status-cell'>" +
          "<span class='admin__badge " +
          badgeClass +
          "' data-status-badge='" +
          id +
          "'>" +
          currentStatus +
          "</span>" +
          "</td>" +
          "<td class='admin__edit-cell'>" +
          "<button type='button' class='btn btn--ghost btn--sm admin__edit-btn' data-booking-id='" +
          id +
          "'>Edit</button>" +
          (currentStatus === "cancelled"
            ? " <button type='button' class='btn admin__btn-delete-permanent' data-booking-id='" + id + "' aria-label='Delete permanently' title='Delete permanently'><span class='admin__icon-trash' aria-hidden='true'></span></button>"
            : "") +
          "<div class='admin__edit-panel' id='editPanel-" +
          id +
          "' style='display:none;'>" +
          "<select class='admin__status-select' data-booking-id='" +
          id +
          "'>" +
          statusOptions +
          "</select>" +
          "<button type='button' class='admin__status-save btn btn--primary btn--sm' data-booking-id='" +
          id +
          "'>Save</button>" +
          "<button type='button' class='admin__edit-cancel btn btn--ghost btn--sm' data-booking-id='" +
          id +
          "'>✕</button>" +
          "<span class='admin__inline-msg' data-msg-id='" +
          id +
          "'></span>" +
          "</div>" +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    // Edit button — show panel, hide Edit button
    bookingsBody.querySelectorAll(".admin__edit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-booking-id");
        var panel = document.getElementById("editPanel-" + id);
        if (panel) panel.style.display = "flex";
        btn.style.display = "none";
      });
    });

    // Cancel button — hide panel, show Edit button
    bookingsBody
      .querySelectorAll(".admin__edit-cancel")
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-booking-id");
          var panel = document.getElementById("editPanel-" + id);
          var editBtn = bookingsBody.querySelector(
            ".admin__edit-btn[data-booking-id='" + id + "']"
          );
          if (panel) panel.style.display = "none";
          if (editBtn) editBtn.style.display = "";
        });
      });

    // Save button
    bookingsBody
      .querySelectorAll(".admin__status-save")
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-booking-id");
          var select = bookingsBody.querySelector(
            ".admin__status-select[data-booking-id='" + id + "']"
          );
          var msgEl = bookingsBody.querySelector(
            ".admin__inline-msg[data-msg-id='" + id + "']"
          );
          var badge = bookingsBody.querySelector(
            "[data-status-badge='" + id + "']"
          );
          var status = select ? select.value : "";

          if (!id || !status) return;
          btn.disabled = true;
          if (msgEl) {
            msgEl.textContent = "Saving…";
            msgEl.className = "admin__inline-msg";
          }

          apiPatch("/api/admin/bookings/" + id, { status: status })
            .then(function (r) {
              if (r.ok) {
                if (badge) {
                  badge.textContent = status;
                  badge.className =
                    "admin__badge " + (statusBadgeClass[status] || "");
                }
                if (msgEl) {
                  msgEl.textContent = "✓ Saved";
                  msgEl.className = "admin__inline-msg admin__inline-msg--ok";
                }
                var editCell = badge && badge.closest("tr") && badge.closest("tr").querySelector(".admin__edit-cell");
                if (status !== "cancelled" && editCell) {
                  var existingDelete = editCell.querySelector(".admin__btn-delete-permanent");
                  if (existingDelete) existingDelete.remove();
                }
                if (status === "cancelled" && editCell && !editCell.querySelector(".admin__btn-delete-permanent")) {
                    var deleteBtn = document.createElement("button");
                    deleteBtn.type = "button";
                    deleteBtn.className = "btn admin__btn-delete-permanent";
                    deleteBtn.setAttribute("data-booking-id", id);
                    deleteBtn.setAttribute("aria-label", "Delete permanently");
                    deleteBtn.setAttribute("title", "Delete permanently");
                    var trashSpan = document.createElement("span");
                    trashSpan.className = "admin__icon-trash";
                    trashSpan.setAttribute("aria-hidden", "true");
                    deleteBtn.appendChild(trashSpan);
                    deleteBtn.style.marginLeft = "0.5rem";
                    editCell.insertBefore(deleteBtn, editCell.querySelector(".admin__edit-panel"));
                    deleteBtn.addEventListener("click", function () {
                      if (!id) return;
                      if (!window.confirm("Are you sure you want to delete this cancelled booking permanently? This cannot be undone.")) return;
                      apiDelete("/api/admin/bookings/" + id).then(function (res) {
                        if (res.ok) {
                          var row = bookingsBody.querySelector("tr[data-booking-id='" + id + "']");
                          if (row) row.remove();
                          bookingsCache = bookingsCache.filter(function (b) {
                            return (b._id || b.id || "").toString() !== id;
                          });
                          refreshStats();
                          if (bookingsBody.querySelectorAll("tr").length === 0 && bookingsEmpty) {
                            bookingsEmpty.style.display = "block";
                          }
                        }
                      });
                    });
                  }
                setTimeout(function () {
                  var panel = document.getElementById("editPanel-" + id);
                  var editBtn = bookingsBody.querySelector(
                    ".admin__edit-btn[data-booking-id='" + id + "']"
                  );
                  if (panel) panel.style.display = "none";
                  if (editBtn) editBtn.style.display = "";
                  if (msgEl) msgEl.textContent = "";
                }, 1500);
              } else {
                if (msgEl) {
                  msgEl.textContent = (r.data && r.data.message) || "Failed";
                  msgEl.className = "admin__inline-msg admin__inline-msg--err";
                }
              }
            })
            .catch(function () {
              if (msgEl) {
                msgEl.textContent = "Network error";
                msgEl.className = "admin__inline-msg admin__inline-msg--err";
              }
            })
            .finally(function () {
              btn.disabled = false;
            });
        });
      });

    // Delete permanently (cancelled bookings only) — confirm before delete
    bookingsBody.querySelectorAll(".admin__btn-delete-permanent").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-booking-id");
        if (!id) return;
        if (!window.confirm("Are you sure you want to delete this cancelled booking permanently? This cannot be undone.")) return;
        apiDelete("/api/admin/bookings/" + id).then(function (res) {
          if (res.ok) {
            var row = bookingsBody.querySelector("tr[data-booking-id='" + id + "']");
            if (row) row.remove();
            bookingsCache = bookingsCache.filter(function (b) {
              return (b._id || b.id || "").toString() !== id;
            });
            refreshStats();
            if (bookingsBody.querySelectorAll("tr").length === 0 && bookingsEmpty) {
              bookingsEmpty.style.display = "block";
            }
          }
        });
      });
    });
  }

  // ─── Utility ──────────────────────────────────────────────────────────────────
  function escapeHtml(s) {
    if (s == null) return "";
    var d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  // ─── Auth UI: bind after DOM is ready so login and password toggle always work ───
  function attachAuthHandlers() {
    var loginForm = document.getElementById("adminLoginForm");
    var loginBtn = document.getElementById("adminLoginBtn");
    var pwToggle = document.getElementById("adminPasswordToggle");
    var pwInput = document.getElementById("adminPassword");
    var otpForm = document.getElementById("adminOtpForm");

    if (loginForm) {
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        doLogin();
      });
    }
    if (loginBtn) {
      loginBtn.addEventListener("click", function (e) {
        e.preventDefault();
        doLogin();
      });
    }
    if (pwToggle && pwInput) {
      pwToggle.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var isPw = pwInput.getAttribute("type") === "password";
        pwInput.setAttribute("type", isPw ? "text" : "password");
        var wrap = pwToggle.closest(".admin__password-wrap");
        if (wrap) {
          var eyeOn = wrap.querySelector(".admin__eye-icon");
          var eyeOff = wrap.querySelector(".admin__eye-off-icon");
          if (eyeOn) eyeOn.style.display = isPw ? "none" : "block";
          if (eyeOff) eyeOff.style.display = isPw ? "block" : "none";
        }
        pwToggle.setAttribute("aria-label", isPw ? "Hide password" : "Show password");
      });
    }
    if (otpForm) {
      otpForm.addEventListener("submit", function (e) {
        e.preventDefault();
        doVerifyOtp();
      });
    }

    var retryBtn = document.getElementById("adminRetryBtn");
    var logoutBtn = document.getElementById("adminLogoutBtn");
    if (retryBtn) retryBtn.addEventListener("click", function () { showView("adminLogin"); });
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        apiPost("/api/admin/logout", {})
          .then(function () { loggedInUsername = ""; showView("adminLogin"); })
          .catch(function () { loggedInUsername = ""; showView("adminLogin"); });
      });
    }
  }

  function runInit() {
    fetch("/api/admin/bookings", { credentials: "include" })
      .then(function (res) {
        if (res.ok) {
          showView("adminDashboard");
          renderBasePrices();
          renderSeasonal();
          loadBlockDates();
          loadBookings();
        } else {
          showView("adminLogin");
        }
      })
      .catch(function () {
        showView("adminLogin");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      attachAuthHandlers();
      runInit();
    });
  } else {
    attachAuthHandlers();
    runInit();
  }
})();
