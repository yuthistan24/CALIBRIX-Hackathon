import {
  apiFetch,
  formatDate,
  getToken,
  loadCurrentUser,
  logout,
  requireAuth,
  severityClass,
  showToast
} from './api.js';

requireAuth('admin');
document.getElementById('logout-button').addEventListener('click', logout);

const metrics = document.getElementById('admin-metrics');
const studentsTable = document.getElementById('students-table');
const counselorsTable = document.getElementById('counselors-table');
const alertsContainer = document.getElementById('admin-alerts');
const heatmap = document.getElementById('district-heatmap');

let charts = [];
let socket;

const CHART_TEXT = '#dbeafe';
const CHART_GRID = 'rgba(148, 163, 184, 0.14)';
const CHART_COLORS = ['#60a5fa', '#3b82f6', '#93c5fd', '#1d4ed8', '#38bdf8'];

function buildMetricCard(label, value) {
  return `
    <article class="metric">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
    </article>
  `;
}

function renderMetrics(analytics) {
  const highRiskCount = analytics.dropoutDistribution.find((item) => item._id === 'High risk')?.count || 0;
  metrics.innerHTML = [
    buildMetricCard('Students', analytics.overview.studentCount),
    buildMetricCard('Counselors', analytics.overview.counselorCount),
    buildMetricCard('Unresolved Alerts', analytics.overview.unresolvedAlerts),
    buildMetricCard('High Dropout Risk', highRiskCount)
  ].join('');
}

function destroyCharts() {
  charts.forEach((chart) => chart.destroy());
  charts = [];
}

function renderCharts(analytics) {
  if (!window.Chart) {
    return;
  }

  destroyCharts();

  charts.push(
    new Chart(document.getElementById('radar-chart'), {
      type: 'radar',
      data: {
        labels: ['A', 'B', 'C', 'D', 'E'],
        datasets: [
          {
            label: 'Average Section Severity',
            data: [
              analytics.radarAverages.A,
              analytics.radarAverages.B,
              analytics.radarAverages.C,
              analytics.radarAverages.D,
              analytics.radarAverages.E
            ],
            backgroundColor: 'rgba(96, 165, 250, 0.18)',
            borderColor: '#60a5fa'
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
            angleLines: { color: CHART_GRID },
            grid: { color: CHART_GRID },
            pointLabels: { color: CHART_TEXT },
            ticks: { color: CHART_TEXT, backdropColor: 'transparent' }
          }
        }
      }
    })
  );

  charts.push(
    new Chart(document.getElementById('risk-bar-chart'), {
      type: 'bar',
      data: {
        labels: analytics.pfadsDistribution.map((item) => item._id),
        datasets: [
          {
            label: 'Students',
            data: analytics.pfadsDistribution.map((item) => item.count),
            backgroundColor: ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8']
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
            beginAtZero: true,
            ticks: { color: CHART_TEXT, precision: 0 },
            grid: { color: CHART_GRID }
          },
          x: {
            ticks: { color: CHART_TEXT },
            grid: { color: CHART_GRID }
          }
        }
      }
    })
  );

  charts.push(
    new Chart(document.getElementById('cluster-pie-chart'), {
      type: 'pie',
      data: {
        labels: analytics.clusterDistribution.map((item) => item._id),
        datasets: [
          {
            data: analytics.clusterDistribution.map((item) => item.count),
            backgroundColor: CHART_COLORS
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
        }
      }
    })
  );

  charts.push(
    new Chart(document.getElementById('sentiment-chart'), {
      type: 'doughnut',
      data: {
        labels: analytics.sentimentTrend.map((item) => item._id),
        datasets: [
          {
            data: analytics.sentimentTrend.map((item) => item.count),
            backgroundColor: ['#34d399', '#94a3b8', '#fb7185']
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
        }
      }
    })
  );
}

function renderHeatmap(patterns) {
  heatmap.innerHTML = (patterns.length ? patterns : [{ district: 'No district data yet', averageScore: 0, alerts: 0 }])
    .map((pattern) => {
      const intensity = Math.min(0.95, 0.25 + pattern.averageScore / 280 + pattern.alerts * 0.08);
      return `
        <div class="heat-cell" style="background: rgba(44, 108, 147, ${intensity})">
          <strong>${pattern.district}</strong>
          <div class="small">Avg score: ${pattern.averageScore}</div>
          <div class="small">Alerts: ${pattern.alerts}</div>
        </div>
      `;
    })
    .join('');
}

function renderStudents(students) {
  studentsTable.innerHTML = (students.length ? students : [{ fullName: 'No students yet', district: '-', latestScore: null, latestPrediction: null }])
    .map(
      (student) => `
        <tr>
          <td>${student.fullName}</td>
          <td>${student.district}</td>
          <td>${student.latestScore?.totalScore ?? 'Pending'}</td>
          <td>${student.latestPrediction?.riskLevel ?? 'Pending'}</td>
        </tr>
      `
    )
    .join('');
}

function renderCounselors(counselors) {
  counselorsTable.innerHTML = (counselors.length ? counselors : [{ name: 'No counselors yet', specialization: [], district: '-', activeSessions: 0, workloadCapacity: 0 }])
    .map(
      (counselor) => `
        <tr>
          <td>${counselor.name}</td>
          <td>${(counselor.specialization || []).join(', ')}</td>
          <td>${counselor.district}</td>
          <td>${counselor.activeSessions}/${counselor.workloadCapacity}</td>
        </tr>
      `
    )
    .join('');
}

function renderAlerts(alerts) {
  if (!alerts.length) {
    alertsContainer.innerHTML = '<div class="list-item"><p>No active alerts.</p></div>';
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
          ${alert.resolved ? '' : `<button class="btn-soft" data-resolve-id="${alert._id}" type="button">Resolve</button>`}
        </div>
      `
    )
    .join('');

  alertsContainer.querySelectorAll('[data-resolve-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await apiFetch(`/api/admin/alerts/${button.dataset.resolveId}/resolve`, {
        method: 'PATCH',
        body: {}
      });
      showToast('Alert resolved');
      await loadDashboard();
    });
  });
}

async function loadDashboard({ refreshUser = true } = {}) {
  if (refreshUser) {
    await loadCurrentUser();
  }
  const [analytics, students, counselors, alerts] = await Promise.all([
    apiFetch('/api/admin/dashboard'),
    apiFetch('/api/admin/students'),
    apiFetch('/api/admin/counselors'),
    apiFetch('/api/admin/alerts')
  ]);

  renderMetrics(analytics);
  renderCharts(analytics);
  renderHeatmap(analytics.districtPatterns);
  renderStudents(students.students);
  renderCounselors(counselors.counselors);
  renderAlerts(alerts.alerts.filter((alert) => !alert.resolved));
}

function setupLiveAlerts() {
  if (socket || !window.io) {
    return;
  }

  socket = window.io({
    auth: {
      token: getToken()
    }
  });

  socket.on('alerts:new', (alert) => {
    showToast(`New ${alert.severity} alert: ${alert.title}`);
    loadDashboard().catch((error) => showToast(error.message, 'error'));
  });

  socket.on('alerts:resolved', () => {
    loadDashboard().catch((error) => showToast(error.message, 'error'));
  });
}

async function initialize() {
  await loadCurrentUser();
  setupLiveAlerts();
  await loadDashboard({ refreshUser: false });
}

initialize().catch((error) => showToast(error.message, 'error'));
