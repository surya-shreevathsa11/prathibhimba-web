/**
 * Gallery horizontal reel: prev/next navigation + lightbox on slide click.
 * Call window.initGalleryReel() after #galleryReelTrack slides are in the DOM (see main.js).
 */
(function () {
  'use strict';

  var autoplayTimer = null;

  function stopGalleryAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function initGalleryReel() {
    var track = document.getElementById('galleryReelTrack');
    var prevBtn = document.getElementById('galleryReelPrev');
    var nextBtn = document.getElementById('galleryReelNext');

    stopGalleryAutoplay();

    if (!track) return;

    var slides = [].slice.call(track.querySelectorAll('.gallery-reel__slide'));
    if (!slides.length) return;

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

    if (prevBtn) {
      prevBtn.onclick = function () {
        var i = getCurrentIndex();
        scrollToIndex(Math.max(0, i - 1));
      };
    }

    if (nextBtn) {
      nextBtn.onclick = function () {
        var i = getCurrentIndex();
        scrollToIndex(Math.min(slides.length - 1, i + 1));
      };
    }

    var AUTOPLAY_MS = 3500;

    function advanceAutoplay() {
      if (document.hidden) return;
      var i = getCurrentIndex();
      scrollToIndex((i + 1) % slides.length);
    }

    function startGalleryAutoplay() {
      if (slides.length <= 1) return;
      stopGalleryAutoplay();
      autoplayTimer = setInterval(advanceAutoplay, AUTOPLAY_MS);
    }

    startGalleryAutoplay();
    document.addEventListener('visibilitychange', function onVis() {
      if (document.hidden) stopGalleryAutoplay();
      else startGalleryAutoplay();
    });

    /* ---- Lightbox ---- */
    var lightbox = document.getElementById('galleryLightbox');
    var lightboxImg = document.getElementById('galleryLightboxImg');

    if (lightbox && lightboxImg) {
      function openFromSlide(slideEl, e) {
        if (!slideEl) return;
        if (e && e.target && e.target.closest && e.target.closest('.gallery-reel__nav')) return;
        var img = slideEl.querySelector('.gallery-reel__img-wrap img');
        if (!img) return;
        stopGalleryAutoplay();
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
        startGalleryAutoplay();
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
