/**
 * Cinematic hero: light scroll-linked motion only (no pin/scrub) for smooth UX.
 * Pin and scrub were removed to prevent lag and freeze with Lenis smooth scroll.
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

  if (!hero) return;

  /* Subtle parallax on scroll: no pin, no scrub. Uses scroll position for a one-way tween. */
  var scrubDuration = 0.6;
  if (heroSlides) {
    gsap.to(heroSlides, {
      y: "-12%",
      ease: "none",
      force3D: true,
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: scrubDuration,
      },
    });
  }
  if (heroVideo) {
    gsap.to(heroVideo, {
      y: "-12%",
      ease: "none",
      force3D: true,
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: scrubDuration,
      },
    });
  }
  if (activeSlide && activeSlide !== heroSlides) {
    gsap.to(activeSlide, {
      y: "-8%",
      ease: "none",
      force3D: true,
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: scrubDuration,
      },
    });
  }
  if (heroContent) {
    gsap.to(heroContent, {
      y: "-4%",
      ease: "none",
      force3D: true,
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: scrubDuration,
      },
    });
  }
};

/* ===== Hero video: ensure drone video is shown (hide random fallback images) ===== */
(function initHeroVideoPlayback() {
  try {
    var hero = document.querySelector(".hero.hero--entry");
    if (!hero) return;
    var videoWrap = hero.querySelector(".hero__video");
    var videoEl = videoWrap ? videoWrap.querySelector("video") : null;
    if (!videoEl) return;

    function markReady() {
      hero.classList.add("hero--video-ready");
    }

    function markFailed() {
      hero.classList.add("hero--video-failed");
    }

    videoEl.addEventListener("canplay", markReady, { once: true });
    videoEl.addEventListener("playing", markReady, { once: true });
    videoEl.addEventListener("loadeddata", markReady, { once: true });
    videoEl.addEventListener("error", markFailed, { once: true });

    // Kick autoplay if allowed (muted + inline). If blocked, fallback slides remain.
    var playPromise = videoEl.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {});
    }
  } catch (e) {
    // If anything fails, keep the existing fallback slides.
  }
})();
