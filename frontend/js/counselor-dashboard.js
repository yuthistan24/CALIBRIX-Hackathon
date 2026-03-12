import {
  apiFetch,
  conversationRoomId,
  formatDate,
  getApiBaseUrl,
  getToken,
  loadCurrentUser,
  logout,
  requireAuth,
  severityClass,
  showToast
} from './api.js';

requireAuth('counselor');
document.getElementById('logout-button').addEventListener('click', logout);

const metrics = document.getElementById('counselor-metrics');
const appointmentsContainer = document.getElementById('counselor-appointments');
const alertsContainer = document.getElementById('counselor-alerts');
const reportContainer = document.getElementById('student-report');

let counselor;
let socket;
let currentReportStudentId = '';

function renderMetrics(data) {
  document.getElementById('counselor-name').textContent = data.counselor.name;
  const assignedTasks = Array.isArray(data.assignedTasks) ? data.assignedTasks : [];
  metrics.innerHTML = [
    { label: 'Active Sessions', value: data.counselor.activeSessions },
    { label: 'Capacity', value: data.counselor.workloadCapacity },
    { label: 'Appointments', value: data.appointments.length },
    { label: 'Open Alerts', value: data.alerts.length },
    { label: 'Assigned Tasks', value: assignedTasks.length }
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

async function loadStudentReport(studentId) {
  currentReportStudentId = studentId;
  const report = await apiFetch(`/api/counselors/students/${studentId}/report`);
  reportContainer.innerHTML = `
    <div class="card-grid">
      <div class="list-item">
        <h3>${report.student.fullName}</h3>
        <p>${report.student.email}</p>
        <p>${report.student.district}</p>
        <p>Dominant risk: ${report.latestCluster?.dominantFactor || 'Pending'}</p>
      </div>
      <div class="list-item">
        <h3>PFADS</h3>
        <p>Total: ${report.latestScore?.totalScore ?? 'Pending'}</p>
        <p>Risk level: ${report.latestScore?.riskLevel ?? 'Pending'}</p>
        <p>Dropout: ${report.latestPrediction?.riskLevel ?? 'Pending'}</p>
      </div>
      <div class="list-item">
        <h3>End-to-end Evaluation</h3>
        <p>Status: ${report.evaluation?.status || 'Stable'}</p>
        <p>Overall risk: ${report.evaluation?.overallRiskIndex ?? 0}/100</p>
        <p>Engagement: ${report.evaluation?.engagementIndex ?? 0}</p>
        <p>Stability: ${report.evaluation?.stabilityIndex ?? 0}</p>
        <p>Variance: ${report.evaluation?.behavioralVarianceIndex ?? 0}</p>
      </div>
      <div class="list-item">
        <h3>Device and Check-In</h3>
        <p>Check-in: ${report.latestCheckin?.metrics?.riskLevel || 'No recent check-in'}</p>
        <p>Sleep: ${report.latestDeviceSync?.sleepHours ?? 0} h</p>
        <p>Focus: ${report.latestDeviceSync?.focusMinutes ?? 0} min</p>
        <p>Screen time: ${report.latestDeviceSync?.screenTimeMinutes ?? 0} min</p>
      </div>
    </div>
    <div class="card-grid">
      <div class="list-item">
        <h3>Concern Drivers</h3>
        <p class="small muted">${(report.evaluation?.concernDrivers || []).join(' | ') || 'No acute drivers flagged.'}</p>
        <p class="small muted">${(report.evaluation?.recommendations || []).join(' | ') || 'No recommendations available.'}</p>
      </div>
      <div class="list-item">
        <h3>Assign Support Task</h3>
        <form id="assign-task-form" class="stack">
          <div class="field">
            <label>Task Title</label>
            <input name="title" placeholder="Example: Complete one 20-minute focus sprint" required />
          </div>
          <div class="field">
            <label>Description</label>
            <textarea name="description" rows="3" placeholder="Add clear instructions or coping context"></textarea>
          </div>
          <div class="field">
            <label>Category</label>
            <input name="category" value="Counselor Plan" />
          </div>
          <div class="field">
            <label>Priority</label>
            <select name="priority">
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div class="field">
            <label>Estimated Minutes</label>
            <input type="number" name="estimatedMinutes" min="1" value="10" />
          </div>
          <div class="field">
            <label>Due Date</label>
            <input type="datetime-local" name="dueDate" />
          </div>
          <button class="btn-soft" type="submit">Assign Task</button>
        </form>
      </div>
    </div>
    <div class="card-grid">
      <div class="list-item">
        <h3>Assigned Tasks</h3>
        <div class="list">
          ${
            (report.assignedTasks || []).length
              ? report.assignedTasks
                  .map(
                    (task) => `
                      <div class="list-item">
                        <div class="button-row">
                          <span class="pill ${severityClass(task.status)}">${task.status}</span>
                          <span class="small muted">${task.dueDate ? formatDate(task.dueDate) : 'No due date'}</span>
                        </div>
                        <p>${task.title}</p>
                        <p class="small muted">${task.description || 'No description provided.'}</p>
                      </div>
                    `
                  )
                  .join('')
              : '<p class="small muted">No tasks assigned yet.</p>'
          }
        </div>
      </div>
      <div class="list-item">
        <h3>Recent Sentiment</h3>
        <div class="list">
          ${(report.sentiments || [])
        .map(
          (entry) => `
            <div class="list-item">
              <div class="button-row">
                <span class="pill ${severityClass(entry.label)}">${entry.label}</span>
                <span class="small muted">${formatDate(entry.createdAt)}</span>
              </div>
              <p>${entry.message}</p>
            </div>
          `
        )
        .join('')}
        </div>
      </div>
    </div>
  `;

  const assignTaskForm = document.getElementById('assign-task-form');
  assignTaskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(assignTaskForm).entries());
    await apiFetch(`/api/counselors/students/${studentId}/tasks`, {
      method: 'POST',
      body: payload
    });
    showToast('Support task assigned');
    await loadStudentReport(studentId);
    await loadDashboard();
  });
}

function renderAppointments(data) {
  if (!data.appointments.length) {
    appointmentsContainer.innerHTML = '<div class="list-item"><p>No appointments assigned.</p></div>';
    return;
  }

  appointmentsContainer.innerHTML = data.appointments
    .map((appointment) => {
      const student = appointment.student;
      const roomId = conversationRoomId(student._id, counselor._id);
      return `
        <div class="list-item">
          <div class="button-row">
            <span class="pill ${severityClass(appointment.status)}">${appointment.status}</span>
            <span class="small muted">${formatDate(appointment.preferredDate)}</span>
          </div>
          <h4>${student.fullName}</h4>
          <p>${student.district}</p>
          <p>${student.dominantRisk}</p>
          <div class="button-row">
            <button class="btn-soft" data-report-id="${student._id}" type="button">View Report</button>
            <a class="btn-ghost" href="/counselor-chat.html?studentId=${student._id}&counselorId=${counselor._id}&roomId=${encodeURIComponent(roomId)}">Open Chat</a>
            <button class="btn-soft" data-appointment-status="${appointment._id}:scheduled" type="button">Mark Scheduled</button>
            <button class="btn-danger" data-appointment-status="${appointment._id}:completed" type="button">Complete</button>
          </div>
        </div>
      `;
    })
    .join('');

  appointmentsContainer.querySelectorAll('[data-report-id]').forEach((button) => {
    button.addEventListener('click', () => loadStudentReport(button.dataset.reportId).catch((error) => showToast(error.message, 'error')));
  });

  appointmentsContainer.querySelectorAll('[data-appointment-status]').forEach((button) => {
    button.addEventListener('click', async () => {
      const [appointmentId, status] = button.dataset.appointmentStatus.split(':');
      await apiFetch(`/api/counselors/appointments/${appointmentId}`, {
        method: 'PATCH',
        body: {
          status,
          scheduledFor: new Date().toISOString()
        }
      });
      showToast(`Appointment marked ${status}`);
      await loadDashboard();
    });
  });
}

function renderAlerts(alerts) {
  if (!alerts.length) {
    alertsContainer.innerHTML = '<div class="list-item"><p>No unresolved counselor alerts.</p></div>';
    return;
  }

  alertsContainer.innerHTML = alerts
    .map(
      (alert) => `
        <div class="list-item">
          <div class="button-row">
            <span class="pill ${severityClass(alert.severity)}">${alert.severity}</span>
            <span class="small muted">${formatDate(alert.createdAt)}</span>
          </div>
          <h4>${alert.title}</h4>
          <p>${alert.student?.fullName || ''}</p>
          <p>${alert.description}</p>
        </div>
      `
    )
    .join('');
}

async function loadDashboard({ refreshUser = true } = {}) {
  if (refreshUser) {
    counselor = await loadCurrentUser();
  }
  const data = await apiFetch('/api/counselors/dashboard');
  renderMetrics(data);
  renderAppointments(data);
  renderAlerts(data.alerts);
}

function setupLiveUpdates() {
  if (socket || !window.io) {
    return;
  }

  const socketBaseUrl = getApiBaseUrl();
  socket = socketBaseUrl
    ? window.io(socketBaseUrl, {
        auth: {
          token: getToken()
        }
      })
    : window.io({
        auth: {
          token: getToken()
        }
      });

  socket.on('alerts:new', (alert) => {
    showToast(`Alert for ${alert.student?.fullName || 'student'}: ${alert.title}`);
    loadDashboard().catch((error) => showToast(error.message, 'error'));
  });

  socket.on('alerts:resolved', () => {
    loadDashboard().catch((error) => showToast(error.message, 'error'));
  });

  socket.on('appointments:new', () => {
    showToast('A new appointment was assigned.');
    loadDashboard().catch((error) => showToast(error.message, 'error'));
  });

  socket.on('tasks:completed', ({ studentId }) => {
    if (currentReportStudentId && studentId === currentReportStudentId) {
      loadStudentReport(studentId).catch((error) => showToast(error.message, 'error'));
    }
    loadDashboard().catch((error) => showToast(error.message, 'error'));
  });
}

async function initialize() {
  counselor = await loadCurrentUser();
  setupLiveUpdates();
  await loadDashboard({ refreshUser: false });
}

initialize().catch((error) => showToast(error.message, 'error'));
