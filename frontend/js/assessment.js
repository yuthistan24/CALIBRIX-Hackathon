import { apiFetch, logout, requireAuth, showToast } from './api.js';

requireAuth('student');

const logoutButton = document.getElementById('logout-button');
const content = document.getElementById('assessment-content');
const form = document.getElementById('assessment-form');
const statusBox = document.getElementById('assessment-status');

logoutButton.addEventListener('click', logout);

let questions = [];

function renderQuestions(questionnaire) {
  const sections = questionnaire.reduce((accumulator, item) => {
    if (!accumulator[item.section]) {
      accumulator[item.section] = {
        title: item.sectionTitle,
        items: []
      };
    }
    accumulator[item.section].items.push(item);
    return accumulator;
  }, {});

  content.innerHTML = Object.entries(sections)
    .map(
      ([section, data]) => `
        <section class="card">
          <div class="section-header">
            <div>
              <h2 class="section-title">${section}. ${data.title}</h2>
              <p class="section-copy">Choose one option for each statement.</p>
            </div>
          </div>
          <div class="question-group">
            ${data.items
              .map(
                (question) => `
                  <div class="question-card">
                    <div class="question-meta">
                      <strong>Q${question.id}</strong>
                      <span class="small muted">${question.sectionTitle}</span>
                    </div>
                    <p>${question.prompt}</p>
                    <div class="scale-row">
                      ${[1, 2, 3, 4, 5]
                        .map(
                          (value) => `
                            <label class="scale-option">
                              <input type="radio" name="q-${question.id}" value="${value}" required />
                              <div>${value}</div>
                            </label>
                          `
                        )
                        .join('')}
                    </div>
                  </div>
                `
              )
              .join('')}
          </div>
        </section>
      `
    )
    .join('');
}

async function loadQuestions() {
  const data = await apiFetch('/api/students/questions', { auth: false });
  questions = data.questionnaire;
  renderQuestions(questions);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(form);
    const answers = questions.map((question) => ({
      questionId: question.id,
      section: question.section,
      value: Number(formData.get(`q-${question.id}`))
    }));

    if (answers.some((answer) => !answer.value)) {
      throw new Error('Please answer every question before submitting.');
    }

    statusBox.textContent = 'Submitting assessment...';
    const result = await apiFetch('/api/students/assessment', {
      method: 'POST',
      body: { answers }
    });
    statusBox.textContent = `Score ${result.score.totalScore} saved. Redirecting to dashboard...`;
    showToast('Assessment submitted successfully');
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 1200);
  } catch (error) {
    statusBox.textContent = error.message;
  }
});

loadQuestions().catch((error) => {
  statusBox.textContent = error.message;
});
