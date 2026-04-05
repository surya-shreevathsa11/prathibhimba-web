/**
 * Scroll-driven premium animations.
 * Section reveal, card slide, parallax, cinematic zoom, counter, card stack.
 * Only attaches animation classes; does not change layout or structure.
 */
(function () {
  "use strict";

  var prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  var skipScrollLinkedEffects =
    window.matchMedia &&
    (window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(max-width: 1024px)").matches);

  var easeOutExpo = "cubic-bezier(0.22, 1, 0.36, 1)";
  var PARALLAX_PX = 40;
  var COUNTER_DURATION = 1200;

  /* ----- 1. Section reveal (IntersectionObserver) ----- */
  var sections = document.querySelectorAll("main .section");
  sections.forEach(function (section) {
    section.classList.add("section-reveal");
  });

  var sectionObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.02 }
  );
  sections.forEach(function (el) {
    sectionObserver.observe(el);
  });

  /* ----- 2. Card grid horizontal slide ----- */
  var cardGrids = document.querySelectorAll(
    ".terms-cards, .reviews__grid, .activities__grid, .rooms__grid"
  );
  cardGrids.forEach(function (grid) {
    grid.classList.add("card-grid-reveal");
  });

  var cardGridObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { root: null, rootMargin: "0px 0px -5% 0px", threshold: 0.05 }
  );
  cardGrids.forEach(function (el) {
    cardGridObserver.observe(el);
  });

  /* Dynamically added room cards: observe #roomsGrid for new children */
  var roomsGrid = document.getElementById("roomsGrid");
  if (roomsGrid && roomsGrid.classList.contains("card-grid-reveal")) {
    var roomObserver = new MutationObserver(function () {
      roomsGrid.querySelectorAll(".room-card").forEach(function (card) {
        if (!card.dataset.slideInAttached) {
          card.dataset.slideInAttached = "1";
        }
      });
    });
    roomObserver.observe(roomsGrid, { childList: true, subtree: true });
  }

  /* ----- 3. Image parallax (hero handled by hero-cinematic.js; only non-hero here) ----- */
  var parallaxEls = document.querySelectorAll(".about__img-wrap");
  if (!skipScrollLinkedEffects) {
    parallaxEls.forEach(function (el) {
      el.classList.add("parallax-img");
    });
  }
  if (!skipScrollLinkedEffects && parallaxEls.length) {
    var ticking = false;

    function updateParallax() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var vh = window.innerHeight;
      parallaxEls.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        var progress = (scrollTop + center - vh / 2) / (vh * 1.5);
        progress = Math.max(-0.5, Math.min(1, progress));
        var y = progress * -PARALLAX_PX;
        el.style.setProperty("transform", "translateY(" + y + "px)");
      });
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    requestAnimationFrame(updateParallax);
  }

  /* ----- 4. Cinematic zoom (hero & feature images) ----- */
  var heroActive = document.querySelector(".hero__slide.is-active");
  if (heroActive) heroActive.classList.add("cinematic-zoom-scroll");
  document.querySelectorAll(".about__img, .events__img-single").forEach(function (img) {
    img.classList.add("cinematic-zoom-scroll");
  });

  /* ----- 5. Statistics counter (0 → target when in view) ----- */
  var statNums = document.querySelectorAll(".stat__num");
  function parseStatValue(text) {
    if (!text || !text.trim()) return { value: 0, suffix: "", isK: false };
    var t = String(text).trim();
    var isK = /k\+?/i.test(t);
    var numStr = t.replace(/[^\d.]/g, "");
    var suffix = t.replace(/[\d.]/g, "").trim() || "";
    var value = parseFloat(numStr);
    if (isNaN(value)) return { value: 0, suffix: t, isK: false };
    return {
      value: isK ? value * 1000 : value,
      displayValue: value,
      displaySuffix: suffix || (isK ? "k+" : ""),
      isK: isK,
    };
  }

  function formatStat(displayVal, suffix, isK) {
    if (isK && displayVal >= 1) {
      var s = displayVal.toFixed(1);
      return (s === "1.0" ? "1" : s.replace(/\.0$/, "")) + "k+";
    }
    if (suffix === "%") return Math.round(displayVal) + "%";
    if (suffix === "+") return Math.round(displayVal) + "+";
    return Math.round(displayVal) + (suffix || "");
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateCounter(el, parsed, duration) {
    var startTime = null;
    var endVal = parsed.displayValue;
    var suffix = parsed.displaySuffix;
    var isK = parsed.isK;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = easeOutCubic(progress);
      var current = eased * endVal;
      el.textContent = formatStat(current, suffix, isK);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counterObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.dataset.counterDone) return;
        el.dataset.counterDone = "1";
        var parsed = parseStatValue(el.textContent);
        el.textContent = "0" + (parsed.displaySuffix || "");
        el.classList.add("stat__num--animate");
        animateCounter(el, parsed, COUNTER_DURATION);
      });
    },
    { root: null, rootMargin: "0px", threshold: 0.3 }
  );
  statNums.forEach(function (el) {
    counterObserver.observe(el);
  });

  /* ----- 6. Card stack (gallery slides move at different speeds) ----- */
  var gallerySection = document.querySelector(".section--gallery");
  var gallerySlides = document.querySelectorAll(".gallery-reel__slide");
  if (!skipScrollLinkedEffects && gallerySection && gallerySlides.length) {
    var stackTicking = false;
    var depthFactors = [0.6, 0.4, 0.2, 0.15, 0.1, 0.08];

    function updateCardStack() {
      var scrollY = window.scrollY || document.documentElement.scrollTop;
      var rect = gallerySection.getBoundingClientRect();
      var sectionTop = scrollY + rect.top - window.innerHeight;
      var sectionHeight = rect.height + window.innerHeight;
      var progress = (scrollY - sectionTop) / sectionHeight;
      progress = Math.max(0, Math.min(1, progress));
      var basePx = 50;
      gallerySlides.forEach(function (slide, i) {
        var factor = depthFactors[i] != null ? depthFactors[i] : 0.05;
        var y = progress * basePx * factor;
        slide.style.transform = "translateY(" + y + "px)";
      });
      stackTicking = false;
    }

    function onScrollStack() {
      if (!stackTicking) {
        requestAnimationFrame(updateCardStack);
        stackTicking = true;
      }
    }

    window.addEventListener("scroll", onScrollStack, { passive: true });
    updateCardStack();
  }
})();
