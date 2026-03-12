import {
  apiFetch,
  conversationRoomId,
  emitAnalyticsEvent,
  formatDate,
  getPreferredLanguage,
  logout,
  requireAuth,
  setPreferredLanguage,
  severityClass,
  showToast
} from './api.js';
import { startStudentSessionTracking } from './activity-tracker.js';

requireAuth('student');
document.getElementById('logout-button').addEventListener('click', logout);

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'ur', label: 'Urdu' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'or', label: 'Odia' }
];

const metricContainer = document.getElementById('student-metrics');
const alertsList = document.getElementById('alerts-list');
const appointmentsList = document.getElementById('appointments-list');
const resourceList = document.getElementById('resource-list');
const hospitalList = document.getElementById('hospital-list');
const resilienceSummary = document.getElementById('resilience-summary');
const appointmentForm = document.getElementById('appointment-form');
const dailyCheckinWrap = document.getElementById('daily-checkin-wrap');
const dailyCheckinHistory = document.getElementById('daily-checkin-history');
const mentorCard = document.getElementById('mentor-card');
const scholarshipList = document.getElementById('scholarship-list');
const psychologistsGrid = document.getElementById('psychologists-grid');
const taskSummary = document.getElementById('task-summary');
const dailyTaskList = document.getElementById('daily-task-list');
const assignedTaskList = document.getElementById('assigned-task-list');
const deviceSummary = document.getElementById('device-summary');
const evaluationSummary = document.getElementById('evaluation-summary');
const deviceSyncForm = document.getElementById('device-sync-form');
const miniGamesList = document.getElementById('mini-games-list');
const videosList = document.getElementById('videos-list');
const languageSelector = document.getElementById('language-selector');

let stopTracking = null;

let pfadsChart;
let emotionChart;

const CHART_TEXT = '#dbeafe';
const CHART_GRID = 'rgba(148, 163, 184, 0.14)';
const CHART_BLUE = '#60a5fa';
const CHART_FILL = 'rgba(96, 165, 250, 0.18)';

function normalizeDashboardData(data = {}) {
  return {
    ...data,
    student: data.student || {},
    supportCopy: data.supportCopy || {},
    latestScore: data.latestScore || null,
    latestCluster: data.latestCluster || null,
    latestPrediction: data.latestPrediction || null,
    latestCheckin: data.latestCheckin || null,
    recentCheckins: Array.isArray(data.recentCheckins) ? data.recentCheckins : [],
    appointments: Array.isArray(data.appointments) ? data.appointments : [],
    sentiments: Array.isArray(data.sentiments) ? data.sentiments : [],
    alerts: Array.isArray(data.alerts) ? data.alerts : [],
    resilienceResources: Array.isArray(data.resilienceResources) ? data.resilienceResources : [],
    dailyCheckinQuestions: Array.isArray(data.dailyCheckinQuestions) ? data.dailyCheckinQuestions : [],
    psychologists: Array.isArray(data.psychologists) ? data.psychologists : [],
    scholarships: Array.isArray(data.scholarships) ? data.scholarships : [],
    personalizedVideos: Array.isArray(data.personalizedVideos) ? data.personalizedVideos : [],
    miniGames: Array.isArray(data.miniGames) ? data.miniGames : [],
    hospitalRecommendations: Array.isArray(data.hospitalRecommendations) ? data.hospitalRecommendations : [],
    deviceIntegration: {
      latestSync: data.deviceIntegration?.latestSync || null,
      hooks: Array.isArray(data.deviceIntegration?.hooks) ? data.deviceIntegration.hooks : []
    },
    evaluation: {
      status: data.evaluation?.status || 'Stable',
      overallRiskIndex: Number(data.evaluation?.overallRiskIndex || 0),
      engagementIndex: Number(data.evaluation?.engagementIndex || 0),
      stabilityIndex: Number(data.evaluation?.stabilityIndex || 0),
      behavioralVarianceIndex: Number(data.evaluation?.behavioralVarianceIndex || 0),
      screenRiskIndex: Number(data.evaluation?.screenRiskIndex || 0),
      sleepRiskIndex: Number(data.evaluation?.sleepRiskIndex || 0),
      concernDrivers: Array.isArray(data.evaluation?.concernDrivers) ? data.evaluation.concernDrivers : [],
      protectiveFactors: Array.isArray(data.evaluation?.protectiveFactors) ? data.evaluation.protectiveFactors : [],
      recommendations: Array.isArray(data.evaluation?.recommendations) ? data.evaluation.recommendations : [],
      summary: data.evaluation?.summary || ''
    },
    taskSummary: {
      tasks: Array.isArray(data.taskSummary?.tasks) ? data.taskSummary.tasks : [],
      assignedTasks: Array.isArray(data.taskSummary?.assignedTasks) ? data.taskSummary.assignedTasks : [],
      streak: Number(data.taskSummary?.streak || 0),
      averageSeconds: Number(data.taskSummary?.averageSeconds || 0),
      completionVarianceSeconds: Number(data.taskSummary?.completionVarianceSeconds || 0),
      completedCount: Number(data.taskSummary?.completedCount || 0),
      completedTodayCount: Number(data.taskSummary?.completedTodayCount || 0),
      completionRate: Number(data.taskSummary?.completionRate || 0),
      assignedCompletedCount: Number(data.taskSummary?.assignedCompletedCount || 0),
      assignedPendingCount: Number(data.taskSummary?.assignedPendingCount || 0),
      overdueAssignedCount: Number(data.taskSummary?.overdueAssignedCount || 0),
      totalAssignedCount: Number(data.taskSummary?.totalAssignedCount || 0)
    }
  };
}

function formatDuration(seconds = 0) {
  const totalSeconds = Number(seconds || 0);
  if (!totalSeconds) {
    return '0m';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function getDateKey() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function setupLanguageSelector() {
  languageSelector.innerHTML = LANGUAGES.map(
    (language) => `<option value="${language.code}">${language.label}</option>`
  ).join('');
  languageSelector.value = getPreferredLanguage();
  languageSelector.addEventListener('change', async () => {
    setPreferredLanguage(languageSelector.value);
    emitAnalyticsEvent('student_dashboard_language_changed', {
      language: languageSelector.value
    });
    await loadDashboard();
  });
}

function applyTranslatedLabels(copy) {
  document.getElementById('mentor-title').textContent = copy.assignedMentor;
  document.getElementById('scholarship-title').textContent = copy.scholarshipSupport;
  document.getElementById('psychologist-title').textContent = copy.psychologistDirectory;
  document.getElementById('tasks-title').textContent = copy.dailyTasks;
  document.getElementById('device-title').textContent = copy.deviceIntegration;
  document.getElementById('games-title').textContent = copy.miniGames;
  document.getElementById('videos-title').textContent = copy.personalizedVideos;
}

function renderMetrics(data) {
  const score = data.latestScore?.totalScore ?? 'Pending';
  const riskLevel = data.latestScore?.riskLevel ?? 'Assessment needed';
  const dropoutRisk = data.latestPrediction?.riskLevel ?? 'Pending';
  const dominantRisk = data.latestCluster?.dominantFactor ?? data.student.dominantRisk ?? 'Pending assessment';
  const dailyWellbeing = data.latestCheckin?.metrics?.wellbeingScore ?? 'No check-in';
  const taskProgress = `${data.taskSummary.completedTodayCount}/${data.taskSummary.tasks.length}`;
  const alertCount = data.alerts.length;
  const sessions = data.appointments.length;
  const moodSignals = data.sentiments.length;

  document.getElementById('student-name').textContent = data.student.fullName;
  metricContainer.innerHTML = [
    { label: 'PFADS Score', value: score },
    { label: 'Risk Band', value: riskLevel },
    { label: 'Dropout Prediction', value: dropoutRisk },
    { label: 'Dominant Factor', value: dominantRisk },
    { label: 'Daily Wellbeing', value: dailyWellbeing },
    { label: 'Tasks Today', value: taskProgress },
    { label: 'Open Alerts', value: alertCount },
    { label: 'Sessions', value: sessions },
    { label: 'Mood Signals', value: moodSignals }
  ]
    .map(
      (metric) => `
        <article class="metric">
          <div class="metric-label">${metric.label}</div>
          <div class="metric-value">${metric.value}</div>
        </article>
      `
    )
    .join('');
}

function renderMentor(data) {
  if (!data.mentorCounselor) {
    mentorCard.innerHTML = '<div class="list-item"><p>No mentor assigned yet. Book a counselling session to get matched.</p></div>';
    return;
  }

  mentorCard.innerHTML = `
    <div class="list-item">
      <div class="profile-row">
        <img class="avatar" src="https://ui-avatars.com/api/?name=${encodeURIComponent(data.mentorCounselor.name)}&background=2c6c93&color=fff" alt="${data.mentorCounselor.name}" />
        <div>
          <h3>${data.mentorCounselor.name}</h3>
          <p>${data.mentorCounselor.mentorMessage}</p>
          <p>${data.mentorCounselor.hospitalOrClinic || ''}</p>
          <p>${data.mentorCounselor.email}</p>
          <p>${data.mentorCounselor.mobileNumber || 'Phone not provided'}</p>
          <div class="button-row">
            <a class="btn-soft" href="mailto:${data.mentorCounselor.email}">Email</a>
            <a class="btn-soft" href="tel:${data.mentorCounselor.mobileNumber || ''}">Call</a>
            <a class="btn" href="/counselor-chat.html?studentId=${data.student._id}&counselorId=${data.mentorCounselor._id}&roomId=${encodeURIComponent(data.mentorCounselor.chatRoomId)}">Chat</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderScholarships(data) {
  scholarshipList.innerHTML = data.scholarships
    .map(
      (scholarship) => `
        <div class="list-item">
          <h4>${scholarship.title}</h4>
          <p>${scholarship.summary}</p>
          <p>${scholarship.guidance}</p>
          <a class="btn-soft" href="${scholarship.link}" target="_blank" rel="noreferrer">Application Guidance</a>
        </div>
      `
    )
    .join('');
}

function renderPsychologists(data) {
  psychologistsGrid.innerHTML = data.psychologists
    .map(
      (psychologist) => `
        <article class="list-item">
          <div class="profile-row">
            <img class="avatar" src="${psychologist.photoUrl}" alt="${psychologist.name}" />
            <div>
              <h3>${psychologist.name}</h3>
              <p>${psychologist.addressLabel}: ${psychologist.address}</p>
              <p>${psychologist.specialties.join(', ')}</p>
              <a class="btn-soft" href="${psychologist.blogUrl}" target="_blank" rel="noreferrer">${psychologist.blogLabel}</a>
            </div>
          </div>
        </article>
      `
    )
    .join('');
}

function renderAlerts(alerts) {
  if (!alerts.length) {
    alertsList.innerHTML = '<div class="list-item"><p>No active alerts.</p></div>';
    return;
  }

  alertsList.innerHTML = alerts
    .map(
      (alert) => `
        <div class="list-item">
          <div class="button-row">
            <span class="pill ${severityClass(alert.severity)}">${alert.severity}</span>
            <span class="small muted">${formatDate(alert.createdAt)}</span>
          </div>
          <h4>${alert.title}</h4>
          <p>${alert.description}</p>
        </div>
      `
    )
    .join('');
}

function renderCharts(data) {
  const pfadsCanvas = document.getElementById('pfads-chart');
  const emotionCanvas = document.getElementById('emotion-chart');

  if (!window.Chart) {
    if (pfadsCanvas) {
      pfadsCanvas.replaceWith(Object.assign(document.createElement('div'), {
        className: 'list-item',
        innerHTML: '<p>Chart.js is unavailable, so visual charts could not load.</p>'
      }));
    }
    return;
  }

  const sectionScores = data.latestScore?.sectionScores || { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const radarData = [sectionScores.A, sectionScores.B, sectionScores.C, sectionScores.D, sectionScores.E];
  pfadsChart?.destroy();
  pfadsChart = new Chart(pfadsCanvas, {
    type: 'radar',
    data: {
      labels: ['Emotional Distress', 'Academic Helplessness', 'Belonging Issues', 'Family Stress', 'Coping Deficit'],
      datasets: [
        {
          label: data.latestScore ? 'Section Severity' : 'Section Severity Placeholder',
          data: radarData,
          backgroundColor: CHART_FILL,
          borderColor: CHART_BLUE,
          pointBackgroundColor: '#bfdbfe'
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          labels: {
            color: CHART_TEXT
          }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 50,
          angleLines: { color: CHART_GRID },
          grid: { color: CHART_GRID },
          pointLabels: { color: CHART_TEXT },
          ticks: {
            color: CHART_TEXT,
            backdropColor: 'transparent'
          }
        }
      }
    }
  });

  const sentiments = data.sentiments.length
    ? [...data.sentiments].reverse()
    : [{ createdAt: new Date().toISOString(), sentimentScore: 0 }];
  emotionChart?.destroy();
  emotionChart = new Chart(emotionCanvas, {
    type: 'line',
    data: {
      labels: sentiments.map((entry) => new Date(entry.createdAt).toLocaleDateString()),
      datasets: [
        {
          label: data.sentiments.length ? 'Sentiment Score' : 'Sentiment Score Placeholder',
          data: sentiments.map((entry) => entry.sentimentScore),
          borderColor: CHART_BLUE,
          backgroundColor: CHART_FILL,
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          labels: {
            color: CHART_TEXT
          }
        }
      },
      scales: {
        y: {
          min: -1,
          max: 1,
          ticks: { color: CHART_TEXT },
          grid: { color: CHART_GRID }
        },
        x: {
          ticks: { color: CHART_TEXT },
          grid: { color: CHART_GRID }
        }
      }
    }
  });
}

function renderTaskSystem(data) {
  taskSummary.innerHTML = `
    <h3>${data.taskSummary.streak} day streak</h3>
    <p>Completed today: ${data.taskSummary.completedTodayCount}/${data.taskSummary.tasks.length}</p>
    <p>Total task completions: ${data.taskSummary.completedCount}</p>
    <p>Average completion time: ${formatDuration(data.taskSummary.averageSeconds)}</p>
    <p>Completion variance: ${formatDuration(data.taskSummary.completionVarianceSeconds)}</p>
    <p>Daily completion rate: ${data.taskSummary.completionRate}%</p>
    <p>Counsellor tasks: ${data.taskSummary.assignedCompletedCount}/${data.taskSummary.totalAssignedCount} completed</p>
    <p>Overdue counsellor tasks: ${data.taskSummary.overdueAssignedCount}</p>
  `;

  dailyTaskList.innerHTML = data.taskSummary.tasks
    .map(
      (task) => `
        <div class="list-item">
          <div class="button-row">
            <span class="pill ${task.completedToday ? 'high' : 'low'}">${task.completedToday ? 'Completed today' : task.category}</span>
            <span class="small muted">${task.estimatedMinutes} min target</span>
          </div>
          <h4>${task.title}</h4>
          <p>${task.description}</p>
          <p class="small muted">
            Completed ${task.completedCount} time(s)
            ${task.latestCompletionAt ? ` | Last: ${formatDate(task.latestCompletionAt)}` : ''}
            | Avg duration: ${formatDuration(task.averageDurationSeconds)}
          </p>
          <button class="btn-soft" data-task-id="${task.id}" data-default-seconds="${task.estimatedMinutes * 60}" type="button">
            ${task.completedToday ? 'Log Again' : 'Mark Complete'}
          </button>
        </div>
      `
    )
    .join('');

  dailyTaskList.querySelectorAll('[data-task-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const durationSeconds = Number(
        window.prompt('How many seconds did this task take?', button.dataset.defaultSeconds) ||
          button.dataset.defaultSeconds
      );

      await apiFetch(`/api/students/daily-tasks/${button.dataset.taskId}/complete`, {
        method: 'POST',
        body: {
          durationSeconds
        }
      });
      emitAnalyticsEvent('student_daily_task_completed', {
        taskId: button.dataset.taskId,
        durationSeconds
      });
      showToast('Task completion logged');
      await loadDashboard();
    });
  });

  if (!data.taskSummary.assignedTasks.length) {
    assignedTaskList.innerHTML = '<div class="list-item"><p>No counsellor-assigned tasks yet.</p></div>';
    return;
  }

  assignedTaskList.innerHTML = data.taskSummary.assignedTasks
    .map(
      (task) => `
        <div class="list-item">
          <div class="button-row">
            <span class="pill ${severityClass(task.status)}">${task.status}</span>
            <span class="small muted">${task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'}</span>
          </div>
          <h4>${task.title}</h4>
          <p>${task.description || 'No description provided.'}</p>
          <p class="small muted">
            Priority: ${task.priority}
            | Estimated: ${task.estimatedMinutes} min
            ${task.counselor?.name ? `| Assigned by ${task.counselor.name}` : ''}
          </p>
          ${
            task.status === 'completed'
              ? `<p class="small muted">Completed ${task.latestCompletionAt ? formatDate(task.latestCompletionAt) : ''}</p>`
              : `<button class="btn-soft" data-assigned-task-id="${task._id}" data-default-seconds="${task.estimatedMinutes * 60}" type="button">Mark Complete</button>`
          }
        </div>
      `
    )
    .join('');

  assignedTaskList.querySelectorAll('[data-assigned-task-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const durationSeconds = Number(
        window.prompt('How many seconds did this counsellor task take?', button.dataset.defaultSeconds) ||
          button.dataset.defaultSeconds
      );

      await apiFetch(`/api/students/assigned-tasks/${button.dataset.assignedTaskId}/complete`, {
        method: 'POST',
        body: {
          durationSeconds
        }
      });
      showToast('Counsellor task completed');
      await loadDashboard();
    });
  });
}

function renderEvaluationSummary(data) {
  evaluationSummary.innerHTML = `
    <div class="button-row">
      <span class="pill ${severityClass(data.evaluation.status)}">${data.evaluation.status}</span>
      <span class="small muted">Overall risk ${data.evaluation.overallRiskIndex}/100</span>
    </div>
    <h3>End-to-end evaluation</h3>
    <p>${data.evaluation.summary || 'No evaluation summary available yet.'}</p>
    <div class="metric-list compact">
      <span>Engagement: ${data.evaluation.engagementIndex}</span>
      <span>Stability: ${data.evaluation.stabilityIndex}</span>
      <span>Variance: ${data.evaluation.behavioralVarianceIndex}</span>
      <span>Screen risk: ${data.evaluation.screenRiskIndex}</span>
      <span>Sleep risk: ${data.evaluation.sleepRiskIndex}</span>
    </div>
    <p class="small muted">${data.evaluation.concernDrivers.join(' | ') || 'No acute concern drivers flagged.'}</p>
    <p class="small muted">${data.evaluation.protectiveFactors.join(' | ') || 'Protective factors will appear as more data is collected.'}</p>
    <p class="small muted">${data.evaluation.recommendations.join(' | ')}</p>
  `;
}

function renderDeviceIntegration(data) {
  const latestSync = data.deviceIntegration.latestSync;
  deviceSummary.innerHTML = latestSync
    ? `
      <h3>${latestSync.source}</h3>
      <p>Steps: ${latestSync.steps}</p>
      <p>Sleep: ${latestSync.sleepHours} hours</p>
      <p>Focus time: ${latestSync.focusMinutes} minutes</p>
      <p>Screen time: ${latestSync.screenTimeMinutes || 0} minutes</p>
      <p>Active minutes: ${latestSync.activeMinutes || 0}</p>
      <p>Idle minutes: ${latestSync.idleMinutes || 0}</p>
      <p>Study screen time: ${latestSync.studyScreenMinutes || 0} minutes</p>
      <p>${latestSync.notes || ''}</p>
      <p class="small muted">${formatDate(latestSync.createdAt)}</p>
      <p class="small muted">${data.deviceIntegration.hooks.map((hook) => `${hook.provider}: ${hook.status}`).join(' | ')}</p>
    `
    : `<p>No device sync yet. Use the form to connect manual or wearable data hooks.</p>`;
}

function renderAppointments(data) {
  if (!data.appointments.length) {
    appointmentsList.innerHTML = '<div class="list-item"><p>No counseling requests yet.</p></div>';
    return;
  }

  appointmentsList.innerHTML = data.appointments
    .map((appointment) => {
      const counselor = appointment.counselor || {};
      const roomId = conversationRoomId(data.student._id, counselor._id);
      return `
        <div class="list-item">
          <div class="button-row">
            <span class="pill ${severityClass(appointment.status)}">${appointment.status}</span>
            <span class="small muted">${formatDate(appointment.preferredDate)}</span>
          </div>
          <h4>${counselor.name || 'Counselor pending'}</h4>
          <p>${(counselor.specialization || []).join(', ')}</p>
          <p>${counselor.email || ''}</p>
          ${
            counselor._id
              ? `<a class="btn-soft" href="/counselor-chat.html?studentId=${data.student._id}&counselorId=${counselor._id}&roomId=${encodeURIComponent(roomId)}">Open Chat</a>`
              : ''
          }
        </div>
      `;
    })
    .join('');
}

function renderDailyCheckin(data) {
  const todayCheckin = data.latestCheckin?.dateKey === getDateKey() ? data.latestCheckin : null;
  const summaryCard = todayCheckin
    ? `
      <div class="list-item">
        <div class="button-row">
          <span class="pill ${severityClass(todayCheckin.metrics.riskLevel)}">${todayCheckin.metrics.riskLevel}</span>
          <span class="small muted">Today</span>
        </div>
        <h3>Wellbeing score: ${todayCheckin.metrics.wellbeingScore}</h3>
        <p>Risk score: ${todayCheckin.metrics.riskScore}</p>
        <p>${todayCheckin.metrics.flags.join(', ') || 'No critical flags detected.'}</p>
      </div>
    `
    : `
      <div class="list-item">
        <h3>Today's check-in is pending</h3>
        <p>Complete the daily questions to track mood, motivation, pressure, and signs of burnout.</p>
      </div>
    `;

  dailyCheckinWrap.innerHTML = `
    ${summaryCard}
    <form id="daily-checkin-form" class="stack">
      ${data.dailyCheckinQuestions
        .map((question) => {
          if (question.type === 'text') {
            return `
              <div class="field">
                <label>${question.id}. ${question.prompt}</label>
                <textarea name="${question.key}" rows="4" placeholder="${question.placeholder || ''}" required>${
                  todayCheckin?.responses?.[question.key] || ''
                }</textarea>
              </div>
            `;
          }

          return `
            <div class="field">
              <label>${question.id}. ${question.prompt}</label>
              <select name="${question.key}" required>
                <option value="">Select an answer</option>
                ${question.options
                  .map(
                    (option) => `
                      <option value="${option.value}" ${todayCheckin?.responses?.[question.key] === option.value ? 'selected' : ''}>${option.label}</option>
                    `
                  )
                  .join('')}
              </select>
            </div>
          `;
        })
        .join('')}
      <button class="btn" type="submit">${todayCheckin ? "Update Today's Check-In" : 'Save Daily Check-In'}</button>
    </form>
  `;

  const form = document.getElementById('daily-checkin-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      await apiFetch('/api/students/daily-checkin', {
        method: 'POST',
        body: payload
      });
      showToast('Daily check-in saved');
      await loadDashboard();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  if (!data.recentCheckins.length) {
    dailyCheckinHistory.innerHTML = '<div class="list-item"><p>No daily check-ins yet.</p></div>';
    return;
  }

  dailyCheckinHistory.innerHTML = data.recentCheckins
    .map(
      (checkin) => `
        <div class="list-item">
          <div class="button-row">
            <span class="pill ${severityClass(checkin.metrics.riskLevel)}">${checkin.metrics.riskLevel}</span>
            <span class="small muted">${checkin.dateKey}</span>
          </div>
          <h4>Wellbeing score ${checkin.metrics.wellbeingScore}</h4>
          <p>${checkin.metrics.flags.join(', ') || 'No critical flags.'}</p>
          <p class="small muted">Challenge: ${checkin.responses.biggest_challenge}</p>
        </div>
      `
    )
    .join('');
}

function renderEngagement(data) {
  miniGamesList.innerHTML = data.miniGames
    .map(
      (game) => `
        <div class="list-item">
          <div class="button-row">
            <span class="pill low">${game.durationMinutes} min</span>
          </div>
          <h4>${game.title}</h4>
          <p>${game.description}</p>
          <a class="btn-soft" href="${game.url}" target="_blank">Play Game</a>
        </div>
      `
    )
    .join('');

  videosList.innerHTML = data.personalizedVideos.length
    ? data.personalizedVideos
        .map(
          (video) => `
            <div class="list-item">
              <h4>${video.title}</h4>
              <p>${video.category}</p>
              <a class="btn-soft" href="${video.videoUrl}" target="_blank" rel="noreferrer">Watch Video</a>
            </div>
          `
        )
        .join('')
    : '<div class="list-item"><p>No personalized videos matched yet. Complete PFADS or a daily check-in to improve recommendations.</p></div>';
}

function renderResources(data) {
  resilienceSummary.innerHTML = `
    <h3>Daily Resilience Score: ${data.student.dailyResilienceScore}</h3>
    <p>Streak: ${data.student.resilienceStreak} day(s)</p>
    <p>Badges: ${(data.student.achievementBadges || []).join(', ') || 'No badges yet'}</p>
  `;

  resourceList.innerHTML = data.resilienceResources
    .map(
      (resource) => `
        <div class="list-item">
          <div class="button-row">
            <span class="pill low">${resource.category}</span>
            <span class="small muted">+${resource.points} points</span>
          </div>
          <h4>${resource.title}</h4>
          <p><a href="${resource.videoUrl}" target="_blank" rel="noreferrer">Open resilience video</a></p>
          <button class="btn-soft" data-resource-id="${resource.id}" type="button">Mark Complete</button>
        </div>
      `
    )
    .join('');

  hospitalList.innerHTML = data.hospitalRecommendations
    .map(
      (entry) => `
        <div class="list-item">
          <h4>${entry.name}</h4>
          <p>${entry.type}</p>
          <p>${entry.address}</p>
          <p>${entry.phone}</p>
        </div>
      `
    )
    .join('') || '<div class="list-item"><p>No hospital recommendations available for this district yet.</p></div>';

  resourceList.querySelectorAll('[data-resource-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await apiFetch('/api/students/resilience', {
        method: 'POST',
        body: {
          activityId: button.dataset.resourceId
        }
      });
      showToast('Resilience progress updated');
      await loadDashboard();
    });
  });
}

async function loadDashboard() {
  const language = getPreferredLanguage();
  const rawData = await apiFetch(`/api/students/dashboard?lang=${language}`);
  const data = normalizeDashboardData(rawData);
  applyTranslatedLabels(data.supportCopy);
  renderMetrics(data);
  renderMentor(data);
  renderScholarships(data);
  renderPsychologists(data);
  renderAlerts(data.alerts);
  renderTaskSystem(data);
  renderEvaluationSummary(data);
  renderDeviceIntegration(data);
  renderCharts(data);
  renderAppointments(data);
  renderDailyCheckin(data);
  renderEngagement(data);
  renderResources(data);
}

appointmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(appointmentForm);
    await apiFetch('/api/students/appointments', {
      method: 'POST',
      body: Object.fromEntries(formData.entries())
    });
    emitAnalyticsEvent('student_appointment_requested');
    appointmentForm.reset();
    showToast('Counseling request assigned');
    await loadDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

deviceSyncForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(deviceSyncForm).entries());
    await apiFetch('/api/students/device-sync', {
      method: 'POST',
      body: payload
    });
    emitAnalyticsEvent('student_device_sync_submitted', {
      source: payload.source || 'Manual device sync'
    });
    deviceSyncForm.reset();
    showToast('Device metrics synced');
    await loadDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

setupLanguageSelector();
stopTracking = startStudentSessionTracking('dashboard');
loadDashboard().catch((error) => showToast(error.message, 'error'));
