(function () {
  "use strict";

  var heroEls = ".hero__subtitle, .hero__title, .hero__content .divider, .hero__desc, .hero__cta";
  var revealTriggers = [];
  var scrubTriggers = [];
  var scrubEntries = [];
  var lenisInstance = null;
  window.getLenis = function () { return lenisInstance; };

  /** Phone / iPad / narrow viewports: native scroll only (Lenis + touch = lag). Laptop unchanged. */
  function useNativeScrollOnly() {
    if (typeof window.matchMedia !== "function") return false;
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.matchMedia("(max-width: 1024px)").matches) return true;
    return false;
  }

  function initLenis() {
    if (typeof Lenis === "undefined") return null;
    if (useNativeScrollOnly()) {
      return null;
    }
    try {
      var lenis = new Lenis({
        smoothWheel: true,
        smoothTouch: false,
        duration: 0.8,
        wheelMultiplier: 1,
        touchMultiplier: 1,
        infinite: false,
        // Disable Lenis only for the chatbot so it uses native scrolling
        prevent: function (node) {
          try {
            return Boolean(node && node.closest && node.closest("#chatbotWindow"));
          } catch (_) {
            return false;
          }
        },
      });
      document.documentElement.classList.add("lenis", "lenis-smooth");

      if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(function (time) {
          lenis.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);
        ScrollTrigger.scrollerProxy(document.body, {
          scrollTop: function (value) {
            if (arguments.length && lenis.scrollTo) {
              lenis.scrollTo(value, { immediate: true });
            }
            return lenis.scroll !== undefined ? (typeof lenis.scroll === "number" ? lenis.scroll : lenis.scroll.top) : window.scrollY;
          },
          getBoundingClientRect: function () {
            return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
          },
        });
      } else {
        function raf(time) {
          lenis.raf(time);
          requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
      }
      return lenis;
    } catch (e) {
      return null;
    }
  }

  function enableScrollAnimations() {
    var prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var st = typeof ScrollTrigger !== "undefined" ? ScrollTrigger : (typeof gsap !== "undefined" && gsap.ScrollTrigger);

    if (typeof gsap === "undefined" || !st) return;
    gsap.registerPlugin(st);

    scrubEntries.forEach(function (e) {
      if (e.container && e.handleEnter && e.handleLeave) {
        e.container.removeEventListener("mouseenter", e.handleEnter);
        e.container.removeEventListener("mouseleave", e.handleLeave);
      }
    });
    scrubEntries.length = 0;
    scrubTriggers.forEach(function (t) {
      if (t && t.kill) t.kill();
    });
    scrubTriggers.length = 0;
    revealTriggers.forEach(function (t) {
      t.kill();
    });
    revealTriggers.length = 0;

    /* Hero: pin + cinematic timeline is in hero-cinematic.js (no duplicate parallax here) */

    /* Section reveals with stagger */
    var hero = document.querySelector(".hero");
    var sections = gsap.utils.toArray(".section").filter(function (section) {
      return !hero || !hero.contains(section);
    });
    sections.forEach(function (section) {
      var els = gsap.utils.toArray("[data-reveal]", section);
      /* #rooms: room cards use CSS-only layout — GSAP stagger/double-target caused misalignment on refresh */
      if (section.id === "rooms") {
        els = els.filter(function (el) {
          return !(el.classList && el.classList.contains("room-card"));
        });
      }
      if (els.length === 0) return;
      if (section.dataset.revealed === "1") {
        gsap.set(els, { opacity: 1, y: 0, scaleX: 1, clearProps: "transform" });
        return;
      }

      /* Card-level stagger for grids (activity cards handled separately below) */
      var cardSelector =
        section.id === "activities"
          ? ".room-card, .review-card, .terms-card, .gallery-reel__slide"
          : ".room-card, .review-card, .activity-card, .terms-card, .gallery-reel__slide";
      var cards = gsap.utils.toArray(cardSelector, section);
      if (section.id === "rooms") {
        cards = cards.filter(function (el) {
          return !(el.classList && el.classList.contains("room-card"));
        });
      }

      var trigger = st.create({
        trigger: section,
        start: "top 85%",
        once: true,
        onEnter: function () {
          if (section.dataset.revealed === "1") return;
          section.dataset.revealed = "1";

          requestAnimationFrame(function () {
            gsap.fromTo(els,
              { opacity: 0, y: 16, force3D: true },
              {
                opacity: 1,
                y: 0,
                duration: prefersReducedMotion ? 0.3 : 0.6,
                stagger: prefersReducedMotion ? 0 : 0.1,
                ease: "cubic-bezier(0.22, 1, 0.36, 1)",
                force3D: true,
                overwrite: "auto",
                clearProps: "transform",
              }
            );

            if (cards.length > 0) {
              gsap.fromTo(cards,
                { opacity: 0, y: 24, scale: 0.97, force3D: true },
                {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  duration: prefersReducedMotion ? 0.3 : 0.55,
                  stagger: prefersReducedMotion ? 0 : 0.08,
                  delay: 0.15,
                  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
                  force3D: true,
                  overwrite: "auto",
                  clearProps: "transform",
                }
              );
            }
          });
        },
      });
      revealTriggers.push(trigger);
    });

    /* Activities section: activity cards reveal from bottom to top (GSAP + ScrollTrigger) */
    var activitiesSection = document.getElementById("activities");
    if (activitiesSection) {
      var activityCards = gsap.utils.toArray(".activity-card", activitiesSection);
      if (activityCards.length > 0) {
        gsap.set(activityCards, {
          y: 120,
          opacity: 0,
          scale: 0.96,
          force3D: true,
        });

        activityCards.forEach(function (card, index) {
          var stInstance = ScrollTrigger.create({
            trigger: activitiesSection,
            start: "top 80%",
            once: true,
            onEnter: function () {
              gsap.to(activityCards, {
                y: 0,
                opacity: 1,
                scale: 1,
                duration: 0.8,
                stagger: 0.12,
                ease: "power3.out",
                force3D: true,
                overwrite: "auto",
                delay: 0.05,
              });
            },
          });
          revealTriggers.push(stInstance);
        });
      }
    }

    ScrollTrigger.refresh();
  }

  window.refreshScrollReveals = function () {
    if (typeof gsap === "undefined") return;
    enableScrollAnimations();
  };

  function runWithGSAP() {
    var main = document.querySelector("main");
    var heroSlidesEl = document.querySelector(".hero__slides");

    if (main) gsap.set(main, { opacity: 0, y: 20 });

    /* 5. Text stagger intro: opacity 0→1, translateY 40→0, blur 6→0, 0.8s, stagger 0.05s, power3.out */
    gsap.set(heroEls, { opacity: 0, y: 40, filter: "blur(6px)" });

    /* 4. Masked image reveal: clip-path inset(100% 0 0 0) → inset(0 0 0 0), 1.2s power4.out on load */
    if (heroSlidesEl) {
      gsap.set(heroSlidesEl, { clipPath: "inset(100% 0 0 0)" });
    }

    var tl = gsap.timeline({
      defaults: { ease: "cubic-bezier(0.22, 1, 0.36, 1)" },
    });

    /* Masked reveal first */
    if (heroSlidesEl) {
      tl.to(heroSlidesEl, {
        clipPath: "inset(0% 0 0 0)",
        duration: 1.2,
        ease: "power4.out",
        force3D: true,
      });
    }

    /* Text stagger intro: subtitle → title → divider → desc → CTA */
    tl.to(
      heroEls,
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.8,
        stagger: 0.05,
        ease: "power3.out",
        force3D: true,
        clearProps: "transform",
      },
      heroSlidesEl ? "-=0.6" : 0
    );

    /* Page fade-in */
    if (main) {
      tl.to(
        main,
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "cubic-bezier(0.22, 1, 0.36, 1)",
          force3D: true,
          clearProps: "transform",
        },
        "-=0.35"
      );
    }

    tl.add(function () {
      var hero = document.querySelector(".hero.hero--entry");
      if (hero) hero.classList.add("hero--entry-done");
      lenisInstance = initLenis();
      enableScrollAnimations();
      if (window.initHeroCinematic) window.initHeroCinematic();
      if (typeof ScrollTrigger !== "undefined") {
        ScrollTrigger.refresh();
      }
    });
  }

  function runWithoutGSAP() {
    var hero = document.querySelector(".hero.hero--entry");
    if (hero) hero.classList.add("hero--entry-done");
    lenisInstance = initLenis();
  }

  function init() {
    var hasGSAP = typeof gsap !== "undefined";

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function onReady() {
        document.removeEventListener("DOMContentLoaded", onReady);
        if (hasGSAP) runWithGSAP();
        else runWithoutGSAP();
      });
    } else {
      if (hasGSAP) runWithGSAP();
      else runWithoutGSAP();
    }
  }
  init();
})();
