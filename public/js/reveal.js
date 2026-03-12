/**
 * Premium reveal animations — minimal JS.
 * Adds page-load reveal, scroll reveal (IntersectionObserver), stagger trigger, button hover class.
 */
(function () {
  "use strict";

  var prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  var main = document.querySelector("main");
  var heroContent = document.querySelector(".hero__content");
  var heroActiveSlide = document.querySelector(".hero__slide.is-active");

  /* 1. Page load reveal — main container */
  if (main) {
    main.classList.add("page-load-reveal");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        main.classList.add("page-load-reveal--done");
      });
    });
  }

  /* 2. Staggered hero content — after page starts revealing */
  if (heroContent) {
    heroContent.classList.add("stagger-reveal");
    setTimeout(function () {
      heroContent.classList.add("stagger-reveal--done");
    }, 50);
  }

  /* 3. Cinematic zoom on active hero slide */
  if (heroActiveSlide) {
    heroActiveSlide.classList.add("cinematic-zoom");
  }

  /* 4. Button micro-interactions */
  document.querySelectorAll(".btn").forEach(function (btn) {
    btn.classList.add("btn-premium-hover");
  });

  /* 5. Scroll reveal — IntersectionObserver */
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length === 0) {
    document.querySelectorAll("section.section").forEach(function (section) {
      section.classList.add("reveal");
    });
    revealEls = document.querySelectorAll(".reveal");
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    {
      root: null,
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.05,
    }
  );

  revealEls.forEach(function (el) {
    observer.observe(el);
  });
})();
