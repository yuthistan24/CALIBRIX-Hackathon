import { emitAnalyticsEvent, showToast } from './api.js';

const FEEDBACK_KEY = 'pfadsplus.feedback';

function loadLatestFeedback() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function saveLatestFeedback(payload) {
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage failures (private mode, quota, etc).
  }
}

function buildFeedbackSection() {
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'feedback-section';
  section.innerHTML = `
    <article class="card">
      <div class="section-header">
        <div>
          <h2 class="section-title">Feedback</h2>
          <p class="section-copy">Rate MindGuard and optionally share a note.</p>
        </div>
      </div>
      <form id="site-feedback-form" class="stack" novalidate>
        <div class="rating-container">
          <div class="star-rating" id="star-rating" aria-label="Site rating">
            <button class="star" type="button" data-value="5" aria-label="5 stars">&#9733;</button>
            <button class="star" type="button" data-value="4" aria-label="4 stars">&#9733;</button>
            <button class="star" type="button" data-value="3" aria-label="3 stars">&#9733;</button>
            <button class="star" type="button" data-value="2" aria-label="2 stars">&#9733;</button>
            <button class="star" type="button" data-value="1" aria-label="1 star">&#9733;</button>
          </div>
          <input id="site-rating-value" name="rating" type="hidden" value="">
          <p class="small muted" id="rating-hint">Select a star rating to enable submit.</p>
        </div>
        <div class="field">
          <label for="site-feedback-text">Comments (optional)</label>
          <textarea
            id="site-feedback-text"
            name="comment"
            rows="3"
            placeholder="What worked well? What should we improve?"
          ></textarea>
        </div>
        <button class="btn" id="site-feedback-submit" type="submit" disabled>Send feedback</button>
      </form>
    </article>
  `;
  return section;
}

function applySelectedStar(stars, selectedValue) {
  stars.forEach((star) => star.classList.remove('is-selected'));
  const match = [...stars].find((star) => star.dataset.value === String(selectedValue));
  if (match) {
    match.classList.add('is-selected');
  }
}

export function initializeReviews() {
  const mount = document.querySelector('.page-shell');
  if (!mount || document.getElementById('feedback-section')) {
    return;
  }

  const section = buildFeedbackSection();
  mount.appendChild(section);

  const stars = section.querySelectorAll('.star');
  const ratingInput = section.querySelector('#site-rating-value');
  const ratingHint = section.querySelector('#rating-hint');
  const submitButton = section.querySelector('#site-feedback-submit');
  const commentInput = section.querySelector('#site-feedback-text');
  const form = section.querySelector('#site-feedback-form');

  const previouslySaved = loadLatestFeedback();
  if (previouslySaved?.rating) {
    ratingInput.value = String(previouslySaved.rating);
    applySelectedStar(stars, ratingInput.value);
    submitButton.disabled = false;
    ratingHint.textContent = `Current rating: ${ratingInput.value}/5.`;
  }

  stars.forEach((star) => {
    star.addEventListener('click', () => {
      const val = star.getAttribute('data-value');
      ratingInput.value = val;
      applySelectedStar(stars, val);
      submitButton.disabled = false;
      ratingHint.textContent = `Selected: ${val}/5.`;
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const rating = Number(ratingInput.value || 0);
    if (!rating) {
      showToast('Please select a star rating first.', 'error');
      return;
    }

    const comment = String(commentInput.value || '').trim();
    const payload = {
      rating,
      comment,
      page: window.location.pathname,
      createdAt: new Date().toISOString()
    };

    saveLatestFeedback(payload);
    emitAnalyticsEvent('site_feedback_submitted', {
      rating,
      hasComment: Boolean(comment),
      commentLength: comment.length
    });

    showToast('Thanks for the feedback.');
    ratingHint.textContent = `Submitted: ${rating}/5.`;
    if (comment) {
      commentInput.value = '';
    }
  });
}
