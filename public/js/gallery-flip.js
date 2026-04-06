/**
 * Gallery horizontal reel: prev/next navigation + lightbox on slide click.
 * Call window.initGalleryReel() after #galleryReelTrack slides are in the DOM (see main.js).
 * Mobile/iPad (≤1024px): duplicate slides for seamless forward loop + scroll reset.
 */
(function () {
  'use strict';

  function isGalleryTouchViewport() {
    return window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;
  }

  function initGalleryReel() {
    var track = document.getElementById('galleryReelTrack');
    var prevBtn = document.getElementById('galleryReelPrev');
    var nextBtn = document.getElementById('galleryReelNext');

    if (!track) return;

    var slides = [].slice.call(track.querySelectorAll('.gallery-reel__slide'));
    if (!slides.length) return;

    var originalCount = slides.length;
    var loopMode = false;

    if (isGalleryTouchViewport() && originalCount > 1) {
      for (var c = 0; c < originalCount; c++) {
        track.appendChild(slides[c].cloneNode(true));
      }
      slides = [].slice.call(track.querySelectorAll('.gallery-reel__slide'));
      loopMode = true;
    }

    function snapLeftFor(el) {
      if (!el) return 0;
      return Math.max(0, el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2);
    }

    function scrollToIndex(index) {
      var slide = slides[Math.max(0, Math.min(index, slides.length - 1))];
      if (slide) track.scrollTo({ left: snapLeftFor(slide), behavior: 'smooth' });
    }

    function getCurrentIndex() {
      var scrollLeft = track.scrollLeft;
      var best = 0;
      var bestDist = Infinity;
      for (var i = 0; i < slides.length; i++) {
        var d = Math.abs(snapLeftFor(slides[i]) - scrollLeft);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    }

    function useLoopNav() {
      return loopMode && isGalleryTouchViewport();
    }

    /**
     * Seamless loop: duplicate set starts at index `originalCount`.
     * Snap positions use centered math (snapLeftFor), not offsetLeft — the old reset subtracted the
     * wrong delta and caused a visible jump. Only reset when the snapped slide is the duplicate
     * first slide, then jump instantly to the real first slide’s snap (same pixels on screen).
     */
    function applyLoopReset() {
      if (!useLoopNav() || !slides[originalCount]) return;
      if (getCurrentIndex() !== originalCount) return;
      track.scrollLeft = snapLeftFor(slides[0]);
    }

    if (loopMode) {
      track.addEventListener('scrollend', applyLoopReset, { passive: true });
      var loopFallbackTimer = null;
      track.addEventListener(
        'scroll',
        function () {
          clearTimeout(loopFallbackTimer);
          loopFallbackTimer = setTimeout(applyLoopReset, 120);
        },
        { passive: true }
      );
    }

    function goNext() {
      if (!useLoopNav()) {
        var j = getCurrentIndex();
        scrollToIndex(Math.min(slides.length - 1, j + 1));
        return;
      }
      var logical = getCurrentIndex() % originalCount;
      var physical = logical === originalCount - 1 ? originalCount : logical + 1;
      scrollToIndex(physical);
    }

    function goPrev() {
      if (!useLoopNav()) {
        var k = getCurrentIndex();
        scrollToIndex(Math.max(0, k - 1));
        return;
      }
      var logical = getCurrentIndex() % originalCount;
      var physical = logical === 0 ? originalCount - 1 : logical - 1;
      scrollToIndex(physical);
    }

    if (prevBtn) {
      prevBtn.onclick = goPrev;
    }

    if (nextBtn) {
      nextBtn.onclick = goNext;
    }

    /* ---- Lightbox ---- */
    var lightbox = document.getElementById('galleryLightbox');
    var lightboxImg = document.getElementById('galleryLightboxImg');

    if (lightbox && lightboxImg) {
      function openFromSlide(slideEl, e) {
        if (!slideEl) return;
        if (e && e.target && e.target.closest && e.target.closest('.gallery-reel__nav')) return;
        var img = slideEl.querySelector('.gallery-reel__img-wrap img');
        if (!img) return;
        var src = img.src.replace(/w=\d+/, 'w=2400').replace(/h=\d+/, 'h=1600');
        lightboxImg.src = src;
        lightboxImg.alt = img.alt;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      }

      track.onclick = function (e) {
        var slide = e.target.closest('.gallery-reel__slide');
        if (!slide) return;
        openFromSlide(slide, e);
      };

      track.onkeydown = function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var slide = e.target && e.target.closest ? e.target.closest('.gallery-reel__slide') : null;
        if (!slide) return;
        e.preventDefault();
        openFromSlide(slide, e);
      };

      function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        lightboxImg.src = '';
      }

      var closeEls = lightbox.querySelectorAll('[data-close]');
      for (var i = 0; i < closeEls.length; i++) {
        closeEls[i].onclick = closeLightbox;
      }

      var overlay = lightbox.querySelector('.modal__overlay');
      if (overlay) overlay.onclick = closeLightbox;

      document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
          closeLightbox();
        }
      });
    }
  }

  window.initGalleryReel = initGalleryReel;
})();
