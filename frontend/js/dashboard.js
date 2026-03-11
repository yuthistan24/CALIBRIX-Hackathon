import {
  apiFetch,
  conversationRoomId,
  formatDate,
  logout,
  requireAuth,
  severityClass,
  showToast
} from './api.js';

const student = requireAuth('student');
document.getElementById('logout-button').addEventListener('click', logout);

const metricContainer = document.getElementById('student-metrics');
const alertsList = document.getElementById('alerts-list');
const appointmentsList = document.getElementById('appointments-list');
const resourceList = document.getElementById('resource-list');
const hospitalList = document.getElementById('hospital-list');
const resilienceSummary = document.getElementById('resilience-summary');
const appointmentForm = document.getElementById('appointment-form');

let pfadsChart;
let emotionChart;

function renderMetrics(data) {
  const score = data.latestScore?.totalScore ?? 'Pending';
  const riskLevel = data.latestScore?.riskLevel ?? 'Assessment needed';
  const dropoutRisk = data.latestPrediction?.riskLevel ?? 'Pending';
  const dominantRisk = data.latestCluster?.dominantFactor ?? data.student.dominantRisk;

  document.getElementById('student-name').textContent = data.student.fullName;
  metricContainer.innerHTML = [
    { label: 'PFADS Score', value: score },
    { label: 'Risk Band', value: riskLevel },
    { label: 'Dropout Prediction', value: dropoutRisk },
    { label: 'Dominant Factor', value: dominantRisk }
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
  if (!window.Chart) {
    return;
  }

  if (data.latestScore) {
    const sectionScores = data.latestScore.sectionScores;
    pfadsChart?.destroy();
    pfadsChart = new Chart(document.getElementById('pfads-chart'), {
      type: 'radar',
      data: {
        labels: ['Emotional Distress', 'Academic Helplessness', 'Belonging Issues', 'Family Stress', 'Coping Deficit'],
        datasets: [
          {
            label: 'Section Severity',
            data: [sectionScores.A, sectionScores.B, sectionScores.C, sectionScores.D, sectionScores.E],
            backgroundColor: 'rgba(44,108,147,0.2)',
            borderColor: '#2c6c93',
            pointBackgroundColor: '#164764'
          }
        ]
      },
      options: {
        scales: {
          r: {
            min: 0,
            max: 50
          }
        }
      }
    });
  }

  const sentiments = [...data.sentiments].reverse();
  emotionChart?.destroy();
  emotionChart = new Chart(document.getElementById('emotion-chart'), {
    type: 'line',
    data: {
      labels: sentiments.map((entry) => new Date(entry.createdAt).toLocaleDateString()),
      datasets: [
        {
          label: 'Sentiment Score',
          data: sentiments.map((entry) => entry.sentimentScore),
          borderColor: '#2c6c93',
          backgroundColor: 'rgba(44,108,147,0.16)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      scales: {
        y: {
          min: -1,
          max: 1
        }
      }
    }
  });
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
    .join('');

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
  const data = await apiFetch('/api/students/dashboard');
  renderMetrics(data);
  renderAlerts(data.alerts);
  renderCharts(data);
  renderAppointments(data);
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
    appointmentForm.reset();
    showToast('Counseling request assigned');
    await loadDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

loadDashboard().catch((error) => showToast(error.message, 'error'));
