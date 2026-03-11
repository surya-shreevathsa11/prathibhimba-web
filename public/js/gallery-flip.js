/**
 * Immersive gallery — FIFO reorder + FLIP animation
 * Click k-th thumbnail: it becomes main; old main goes into stack so that
 * new stack = [thumbnails after k, old main, thumbnails before k] (bottoms-up FIFO).
 * All position changes animate smoothly with GSAP Flip.
 */

(function () {
  'use strict';

  if (typeof gsap === 'undefined' || typeof Flip === 'undefined') return;
  gsap.registerPlugin(Flip);

  var gallery = document.getElementById('immersiveGallery');
  if (!gallery) return;

  var mainSlot = gallery.querySelector('.immersive-gallery__main');
  var stackSlot = gallery.querySelector('.immersive-gallery__stack');
  if (!mainSlot || !stackSlot) return;

  var isAnimating = false;
  var DURATION = 0.85;
  var EASE = 'power3.inOut';

  /**
   * Get all gallery cards in document order (main first, then stack order).
   */
  function getOrderedCards() {
    var mainCard = mainSlot.querySelector('.gallery-card');
    var stackCards = [].slice.call(stackSlot.querySelectorAll('.gallery-card'));
    return mainCard ? [mainCard].concat(stackCards) : stackCards;
  }

  /**
   * Update data-index and number labels (01, 02, …) for all cards.
   */
  function updateIndices() {
    var cards = getOrderedCards();
    cards.forEach(function (card, i) {
      var idx = i + 1;
      card.dataset.index = i;
      var numEl = card.querySelector('.gallery-card__number');
      if (numEl) numEl.textContent = (idx < 10 ? '0' : '') + idx;
    });
  }

  /**
   * FIFO reorder: clicked thumbnail becomes main; old main goes into stack so that
   * new stack = [items after clicked, old main, items before clicked]. Then FLIP.
   * E.g. click 2nd → 1st goes to 5th; click 3rd → 1st to 4th, 2nd to 5th.
   */
  function promoteToMain(clickedCard) {
    if (isAnimating) return;
    if (clickedCard.closest('.immersive-gallery__main')) return;

    var mainCard = mainSlot.querySelector('.gallery-card');
    if (!mainCard) return;

    var stackCards = [].slice.call(stackSlot.querySelectorAll('.gallery-card'));
    var clickedIndex = stackCards.indexOf(clickedCard);
    if (clickedIndex === -1) return;

    // 1. Capture state before DOM change
    var state = Flip.getState('.gallery-card', { absolute: true });

    // 2. New stack order (FIFO): after clicked → old main → before clicked
    var afterClicked = stackCards.slice(clickedIndex + 1);
    var beforeClicked = stackCards.slice(0, clickedIndex);
    var newStackOrder = afterClicked.concat([mainCard]).concat(beforeClicked);

    // 3. Move clicked to main
    mainCard.classList.remove('gallery-card--main');
    clickedCard.classList.add('gallery-card--main');
    mainSlot.appendChild(clickedCard);

    // 4. Rebuild stack in new order
    var fragment = document.createDocumentFragment();
    newStackOrder.forEach(function (card) {
      fragment.appendChild(card);
    });
    stackSlot.innerHTML = '';
    stackSlot.appendChild(fragment);

    // 5. Update labels (01, 02, …)
    updateIndices();

    // 6. Animate (slight stagger for immersive cascade)
    isAnimating = true;
    Flip.from(state, {
      duration: DURATION,
      ease: EASE,
      absolute: true,
      scale: true,
      nested: true,
      nestedDelay: 0.04,
      onComplete: function () {
        isAnimating = false;
      }
    });
  }

  /**
   * Bind click to stack cards (delegated).
   */
  stackSlot.addEventListener('click', function (e) {
    var card = e.target.closest('.gallery-card');
    if (card && card.parentNode === stackSlot) promoteToMain(card);
  });

  stackSlot.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest('.gallery-card');
    if (card && card.parentNode === stackSlot) {
      e.preventDefault();
      promoteToMain(card);
    }
  });

  // Initial indices (in case HTML order differs)
  updateIndices();
})();
