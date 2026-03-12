const SESSION_KEY = 'pfadsplus.session';
const LANGUAGE_KEY = 'pfadsplus.language';
const API_BASE_KEY = 'pfadsplus.apiBase';

export function getApiBaseUrl() {
  try {
    const explicit = String(window.__PFADS_API_BASE_URL || '').trim();
    if (explicit) {
      return explicit.replace(/\/$/, '');
    }

    const saved = String(localStorage.getItem(API_BASE_KEY) || '').trim();
    if (saved) {
      return saved.replace(/\/$/, '');
    }
  } catch (_error) {
    // Ignore storage access issues and fall back to inferred defaults.
  }

  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isNodePort = window.location.port === '3000';
  if (isLocalHost && !isNodePort) {
    // Common dev setup: frontend served from Apache (80/443), API on Node (3000).
    return 'http://localhost:3000';
  }

  return '';
}

function resolveApiUrl(path = '') {
  const url = String(path || '');
  if (!url || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const base = getApiBaseUrl();
  if (!base) {
    return url;
  }

  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch (_error) {
    return null;
  }
}

export function saveSession(payload) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token: payload.token,
      user: payload.user
    })
  );
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getToken() {
  return getSession()?.token || '';
}

export function getUser() {
  return getSession()?.user || null;
}

export function getPreferredLanguage() {
  return localStorage.getItem(LANGUAGE_KEY) || 'en';
}

export function setPreferredLanguage(language) {
  localStorage.setItem(LANGUAGE_KEY, language);
}

export function requireAuth(allowedRoles) {
  const session = getSession();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!session?.token || !session?.user || (roles[0] && !roles.includes(session.user.role))) {
    clearSession();
    window.location.href = '/index.html';
    throw new Error('Unauthorized');
  }
  return session.user;
}

export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, auth = true } = options;
  const headers = {
    'Content-Type': 'application/json'
  };

  if (auth && getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }

  const response = await fetch(resolveApiUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || 'Request failed');
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function logout() {
  clearSession();
  window.location.href = '/index.html';
}

export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = type === 'error' ? `Error: ${message}` : message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

export function formatDate(dateValue) {
  return new Date(dateValue).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function severityClass(value = '') {
  const normalized = value.toLowerCase();
  if (normalized.includes('high') || normalized.includes('overdue') || normalized.includes('danger')) {
    return 'high';
  }
  if (
    normalized.includes('moderate') ||
    normalized.includes('medium') ||
    normalized.includes('in_progress') ||
    normalized.includes('negative')
  ) {
    return 'medium';
  }
  return 'low';
}

export function conversationRoomId(studentId, counselorId) {
  return `student:${studentId}:counselor:${counselorId}`;
}

export function emitAnalyticsEvent(name, detail = {}) {
  const payload = {
    name,
    detail,
    createdAt: new Date().toISOString()
  };

  window.dispatchEvent(new CustomEvent('pfads:analytics', { detail: payload }));

  if (typeof window.__pfadsAnalytics?.track === 'function') {
    window.__pfadsAnalytics.track(name, detail);
  }
}

export async function loadCurrentUser() {
  const result = await apiFetch('/api/auth/me');
  const session = getSession();
  saveSession({
    token: session.token,
    user: result.user
  });
  return result.user;
}
