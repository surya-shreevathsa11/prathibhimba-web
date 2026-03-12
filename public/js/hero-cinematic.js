/**
 * Cinematic hero reveal: pin, background zoom, text parallax exit, depth layers.
 * GSAP + ScrollTrigger only. No layout/HTML/typography/color changes.
 * Call initHeroCinematic() after Lenis is ready (e.g. from animations.js timeline callback).
 */
window.initHeroCinematic = function () {
  "use strict";

  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  var prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  var hero = document.querySelector(".hero");
  var heroSlides = document.querySelector(".hero__slides");
  var heroVideo = document.querySelector(".hero__video");
  var activeSlide = document.querySelector(".hero__slide.is-active");
  var heroContent = document.querySelector(".hero__content");
  var heroSubtitle = document.querySelector(".hero__subtitle");
  var heroTitle = document.querySelector(".hero__title");

  if (!hero) return;

  /* Will-change for performance (animation-only) */
  [heroSlides, heroVideo, activeSlide, heroContent].forEach(function (el) {
    if (el) el.style.willChange = "transform";
  });
  if (heroSubtitle) heroSubtitle.style.willChange = "transform, opacity";
  if (heroTitle) heroTitle.style.willChange = "transform, opacity";

  /* 1. Hero pinning: pin for 150vh scroll, scrub-controlled */
  var tl = gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "+=150%",
      pin: true,
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  /* 2. Background cinematic zoom: scale 1 → 1.2 (on active slide) */
  if (activeSlide) {
    tl.to(
      activeSlide,
      {
        scale: 1.2,
        ease: "none",
        force3D: true,
      },
      0
    );
  }

  /* 6. Depth parallax: background -30%, image -15%, text -5% */
  if (heroSlides) {
    tl.to(heroSlides, { y: "-30%", ease: "none", force3D: true }, 0);
  }
  if (heroVideo) {
    tl.to(heroVideo, { y: "-30%", ease: "none", force3D: true }, 0);
  }
  if (activeSlide && activeSlide !== heroSlides) {
    tl.to(activeSlide, { y: "-15%", ease: "none", force3D: true }, 0);
  }
  if (heroContent) {
    tl.to(heroContent, { y: "-5%", ease: "none", force3D: true }, 0);
  }

  /* 3. Text parallax exit: headline + subtitle → -200px, opacity 0 */
  if (heroSubtitle) {
    tl.to(heroSubtitle, { y: -200, opacity: 0, ease: "none", force3D: true }, 0);
  }
  if (heroTitle) {
    tl.to(heroTitle, { y: -200, opacity: 0, ease: "none", force3D: true }, 0);
  }

  window._heroCinematicTrigger = tl.scrollTrigger;
};
