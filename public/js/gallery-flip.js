/**
 * Gallery horizontal reel: prev/next navigation + lightbox on slide click
 */
(function () {
  'use strict';

  var track = document.getElementById('galleryReelTrack');
  var prevBtn = document.getElementById('galleryReelPrev');
  var nextBtn = document.getElementById('galleryReelNext');

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
    prevBtn.addEventListener('click', function () {
      var i = getCurrentIndex();
      scrollToIndex(Math.max(0, i - 1));
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      var i = getCurrentIndex();
      scrollToIndex(Math.min(slides.length - 1, i + 1));
    });
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

    track.addEventListener('click', function (e) {
      var slide = e.target.closest('.gallery-reel__slide');
      if (!slide) return;
      openFromSlide(slide, e);
    });

    track.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var slide = e.target && e.target.closest ? e.target.closest('.gallery-reel__slide') : null;
      if (!slide) return;
      e.preventDefault();
      openFromSlide(slide, e);
    });

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      lightboxImg.src = '';
    }

    var closeEls = lightbox.querySelectorAll('[data-close]');
    for (var i = 0; i < closeEls.length; i++) {
      closeEls[i].addEventListener('click', closeLightbox);
    }

    var overlay = lightbox.querySelector('.modal__overlay');
    if (overlay) overlay.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });
  }
})();
