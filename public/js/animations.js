(function () {
  "use strict";

  var heroEls = ".hero__subtitle, .hero__title, .hero__content .divider, .hero__desc, .hero__cta";
  var revealTriggers = [];
  var scrubTriggers = [];
  var scrubEntries = [];
  var lenisInstance = null;
  window.getLenis = function () { return lenisInstance; };

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

    /* Hero parallax — slides move slower than foreground on scroll */
    if (!prefersReducedMotion) {
      var heroSlides = document.querySelector(".hero__slides");
      if (heroSlides) {
        var heroAnim = gsap.to(heroSlides, {
          y: "18%",
          ease: "none",
          force3D: true,
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: 1.5,
          },
        });
        if (heroAnim && heroAnim.scrollTrigger) scrubTriggers.push(heroAnim.scrollTrigger);
      }

      /* Hero video parallax */
      var heroVideo = document.querySelector(".hero__video");
      if (heroVideo) {
        var vidAnim = gsap.to(heroVideo, {
          y: "14%",
          ease: "none",
          force3D: true,
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: 1.5,
          },
        });
        if (vidAnim && vidAnim.scrollTrigger) scrubTriggers.push(vidAnim.scrollTrigger);
      }
    }

    /* Section reveals with stagger */
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

      /* Card-level stagger for grids */
      var cards = gsap.utils.toArray(
        ".room-card, .review-card, .activity-card, .terms-card, .gallery-reel__slide",
        section
      );

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
    ScrollTrigger.refresh();
  }

  window.refreshScrollReveals = function () {
    if (typeof gsap === "undefined") return;
    enableScrollAnimations();
  };

  function runWithGSAP() {
    /* Hide main until ready */
    var main = document.querySelector("main");
    if (main) gsap.set(main, { opacity: 0, y: 20 });

    gsap.set(heroEls, { opacity: 0, y: 16 });

    var tl = gsap.timeline({
      defaults: { ease: "cubic-bezier(0.22, 1, 0.36, 1)" },
    });

    /* Page fade-in */
    if (main) {
      tl.to(main, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "cubic-bezier(0.22, 1, 0.36, 1)",
        force3D: true,
        clearProps: "transform",
      });
    }

    /* Hero content stagger: subtitle → title → divider → desc → CTA */
    tl.to(heroEls, {
      opacity: 1,
      y: 0,
      stagger: 0.1,
      duration: 0.6,
      ease: "cubic-bezier(0.22, 1, 0.36, 1)",
      force3D: true,
      clearProps: "transform",
    }, main ? "-=0.35" : 0);

    /* Cinematic zoom on hero slide images */
    var activeSlide = document.querySelector(".hero__slide.is-active");
    if (activeSlide) {
      tl.to(activeSlide, {
        scale: 1.06,
        duration: 10,
        ease: "power1.out",
        force3D: true,
      }, 0);
    }

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
