import { apiFetch, emitAnalyticsEvent, getToken } from './api.js';

function buildSessionId(screenName) {
  return `session:${screenName}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export function startStudentSessionTracking(screenName = 'student-screen') {
  const token = getToken();
  if (!token) {
    return () => {};
  }

  const sessionId = buildSessionId(screenName);
  const startedAt = Date.now();
  let totalVisibleSeconds = 0;
  let activeSeconds = 0;
  let intervalId = null;
  let syncIntervalId = null;
  let destroyed = false;
  let lastUserActivityAt = Date.now();
  let lastSyncedPayload = '';

  const markActivity = () => {
    lastUserActivityAt = Date.now();
  };

  const trackTick = () => {
    if (document.visibilityState !== 'visible') {
      return;
    }

    totalVisibleSeconds += 15;
    if (Date.now() - lastUserActivityAt <= 60000) {
      activeSeconds += 15;
    }
  };

  const buildPayload = () => {
    const totalMinutes = Number((totalVisibleSeconds / 60).toFixed(1));
    const activeMinutes = Number((activeSeconds / 60).toFixed(1));
    const idleMinutes = Number(Math.max(0, totalMinutes - activeMinutes).toFixed(1));
    const studyScreenMinutes = ['dashboard', 'assessment'].includes(screenName) ? activeMinutes : 0;
    const activityScore = Math.round(
      Math.max(0, Math.min(100, activeMinutes * 1.5 - idleMinutes * 0.5 + studyScreenMinutes))
    );

    return {
      source: 'MindGuard Web App',
      hookType: 'web_session',
      sessionId,
      screenName,
      dateKey: new Date().toISOString().slice(0, 10),
      screenTimeMinutes: totalMinutes,
      activeMinutes,
      idleMinutes,
      studyScreenMinutes,
      focusMinutes: activeMinutes,
      activityScore,
      sourceMeta: {
        userAgent: navigator.userAgent
      }
    };
  };

  const flush = async (reason = 'periodic', keepalive = false) => {
    if (destroyed) {
      return;
    }

    const payload = buildPayload();
    const serialized = JSON.stringify(payload);
    if (serialized === lastSyncedPayload && reason !== 'unload') {
      return;
    }

    lastSyncedPayload = serialized;

    if (keepalive) {
      await fetch('/api/students/device-sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: serialized,
        keepalive: true
      }).catch(() => {});
      return;
    }

    await apiFetch('/api/students/device-sync', {
      method: 'POST',
      body: payload
    }).catch(() => {});

    emitAnalyticsEvent('student_screen_tracking_synced', {
      screenName,
      reason,
      screenTimeMinutes: payload.screenTimeMinutes,
      activeMinutes: payload.activeMinutes
    });
  };

  intervalId = window.setInterval(trackTick, 15000);
  syncIntervalId = window.setInterval(() => {
    flush('periodic').catch(() => {});
  }, 60000);

  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, markActivity, { passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush('hidden').catch(() => {});
    } else {
      markActivity();
    }
  });

  window.addEventListener('beforeunload', () => {
    flush('unload', true).catch(() => {});
  });

  markActivity();
  emitAnalyticsEvent('student_screen_tracking_started', {
    screenName,
    sessionId,
    startedAt
  });

  return () => {
    destroyed = true;
    window.clearInterval(intervalId);
    window.clearInterval(syncIntervalId);
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
      window.removeEventListener(eventName, markActivity);
    });
  };
}
