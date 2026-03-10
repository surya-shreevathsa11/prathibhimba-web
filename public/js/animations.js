(function () {
  "use strict";

  var heroEls = ".hero__subtitle, .hero__title, .hero__content .divider, .hero__desc, .hero__cta";
  var revealTriggers = [];
  var scrubTriggers = [];
  var scrubEntries = [];
  var lenisInstance = null;
  window.getLenis = function () { return lenisInstance; };

  /* Lenis: keep smooth scroll for desktop, mobile and iPad. Do not disable or override
   * smoothTouch/touchMultiplier so mobile and tablet scroll stays consistent in future. */
  function initLenis() {
    if (typeof Lenis === "undefined") return null;
    try {
      var lenis = new Lenis({
        duration: 1.2,
        smoothWheel: true,
        smoothTouch: true,
        touchMultiplier: 2,
        infinite: false,
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

  function getRevealFrom(type, scrollDown) {
    if (scrollDown) {
      switch (type) {
        case "clip":
          return { opacity: 0, y: -48, force3D: true };
        case "flow":
          return { opacity: 0, scaleX: 0.88, transformOrigin: "center center", force3D: true };
        case "slide-down":
          return { opacity: 0, y: 40, force3D: true };
        default:
          return { opacity: 0, y: -56, scale: 0.98, force3D: true };
      }
    }
    switch (type) {
      case "clip":
        return { opacity: 0, y: 52, force3D: true };
      case "flow":
        return { opacity: 0, scaleX: 0.82, transformOrigin: "center center", force3D: true };
      case "slide-down":
        return { opacity: 0, y: -36, force3D: true };
      default:
        return { opacity: 0, y: 56, scale: 0.98, force3D: true };
    }
  }

  function getRevealTo(type, scrollDown) {
    if (type === "flow") return { opacity: 1, scaleX: 1 };
    return { opacity: 1, y: 0, scale: 1 };
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

    if (!prefersReducedMotion) {
      var heroSlides = document.querySelector(".hero__slides");
      if (heroSlides) {
        var heroAnim = gsap.to(heroSlides, {
          y: "12%",
          ease: "none",
          force3D: true,
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        });
        if (heroAnim && heroAnim.scrollTrigger) scrubTriggers.push(heroAnim.scrollTrigger);
      }
    }

    var hero = document.querySelector(".hero");
    var sections = gsap.utils.toArray(".section").filter(function (section) {
      return !hero || !hero.contains(section);
    });
    sections.forEach(function (section) {
      var els = gsap.utils.toArray("[data-reveal]", section);
      if (els.length === 0) return;
      if (section.dataset.revealed === "1") {
        gsap.set(els, { opacity: 1, y: 0, scaleX: 1, clearProps: "transform" });
        return;
      }
      var trigger = st.create({
        trigger: section,
        start: "top 88%",
        once: true,
        onEnter: function () {
          if (section.dataset.revealed === "1") return;
          section.dataset.revealed = "1";
          var fromVars = { opacity: 0, y: 40, force3D: true };
          var toVars = {
            opacity: 1,
            y: 0,
            duration: prefersReducedMotion ? 0.3 : 0.7,
            stagger: prefersReducedMotion ? 0 : 0.12,
            ease: "power3.out",
            force3D: true,
            overwrite: "auto",
            clearProps: "transform",
          };
          requestAnimationFrame(function () {
            gsap.fromTo(els, fromVars, toVars);
          });
        },
      });
      revealTriggers.push(trigger);
    });
    ScrollTrigger.refresh();
  }

  window.refreshScrollReveals = function () {
    if (typeof gsap === "undefined") return;
    enableScrollAnimations();
  };

  function runWithGSAP() {
    gsap.set(heroEls, { opacity: 0, y: 60 });
    gsap.set(".hero", { scale: 1.05 });

    var tl = gsap.timeline({ defaults: { ease: "power3.inOut" } });

    tl.to(".hero", {
      scale: 1,
      duration: 1.4,
      ease: "power3.out",
    });

    tl.to(heroEls, {
      opacity: 1,
      y: 0,
      stagger: 0.2,
      duration: 1,
      ease: "power3.out",
    }, "-=0.6");

    tl.add(function () {
      var hero = document.querySelector(".hero.hero--entry");
      if (hero) hero.classList.add("hero--entry-done");
      lenisInstance = initLenis();
      enableScrollAnimations();
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
