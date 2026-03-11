import {
  apiFetch,
  formatDate,
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
            backgroundColor: 'rgba(44,108,147,0.16)',
            borderColor: '#2c6c93'
          }
        ]
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
            backgroundColor: ['#8bb8d1', '#6f9db7', '#4d7d9b', '#2c5a75']
          }
        ]
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
            backgroundColor: ['#2c6c93', '#5f8faa', '#8aa9ba', '#35637e', '#6a8594']
          }
        ]
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
            backgroundColor: ['#2b845f', '#8ba5b8', '#c14d5f']
          }
        ]
      }
    })
  );
}

function renderHeatmap(patterns) {
  heatmap.innerHTML = patterns
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
  studentsTable.innerHTML = students
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
  counselorsTable.innerHTML = counselors
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

async function loadDashboard() {
  await loadCurrentUser();
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

loadDashboard().catch((error) => showToast(error.message, 'error'));
