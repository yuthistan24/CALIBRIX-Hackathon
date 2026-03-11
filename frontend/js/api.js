const SESSION_KEY = 'pfadsplus.session';

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

  const response = await fetch(path, {
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
  if (normalized.includes('high')) {
    return 'high';
  }
  if (normalized.includes('moderate') || normalized.includes('medium')) {
    return 'medium';
  }
  return 'low';
}

export function conversationRoomId(studentId, counselorId) {
  return `student:${studentId}:counselor:${counselorId}`;
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
