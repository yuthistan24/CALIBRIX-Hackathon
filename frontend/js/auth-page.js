import { apiFetch, saveSession, showToast } from './api.js';

const form = document.querySelector('[data-auth-form]');
const errorBox = document.querySelector('[data-error-box]');

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const result = await apiFetch(form.dataset.endpoint, {
        method: 'POST',
        body: payload,
        auth: false
      });
      saveSession(result);
      showToast('Authentication successful');
      window.location.href = result.redirectTo;
    } catch (error) {
      errorBox.textContent = error.message;
    }
  });
}
