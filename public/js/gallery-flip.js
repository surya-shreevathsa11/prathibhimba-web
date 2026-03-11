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

  function scrollToIndex(index) {
    var slide = slides[Math.max(0, Math.min(index, slides.length - 1))];
    if (slide) track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
  }

  function getCurrentIndex() {
    var scrollLeft = track.scrollLeft;
    var best = 0;
    var bestDist = Infinity;
    for (var i = 0; i < slides.length; i++) {
      var d = Math.abs(slides[i].offsetLeft - scrollLeft);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      var i = getCurrentIndex();
      var next = Math.max(0, i - 1);
      scrollToIndex(next);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      var i = getCurrentIndex();
      var next = Math.min(slides.length - 1, i + 1);
      scrollToIndex(next);
    });
  }

  /* ---- Lightbox ---- */
  var lightbox = document.getElementById('galleryLightbox');
  var lightboxImg = document.getElementById('galleryLightboxImg');

  if (lightbox && lightboxImg) {
    slides.forEach(function (slide) {
      function openLightbox(e) {
        if (e.target.closest('.gallery-reel__nav')) return;
        var img = slide.querySelector('.gallery-reel__img-wrap img');
        if (!img) return;
        var src = img.src
          .replace(/w=\d+/, 'w=2400')
          .replace(/h=\d+/, 'h=1600');
        lightboxImg.src = src;
        lightboxImg.alt = img.alt;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      }

      slide.addEventListener('click', openLightbox);
      slide.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(e);
        }
      });
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
