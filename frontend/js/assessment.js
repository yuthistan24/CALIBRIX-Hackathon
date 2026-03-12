import { apiFetch, logout, requireAuth, showToast } from './api.js';
import { startStudentSessionTracking } from './activity-tracker.js';

requireAuth('student');

const logoutButton = document.getElementById('logout-button');
const selector = document.getElementById('questionnaire-selector');
const content = document.getElementById('assessment-content');
const form = document.getElementById('assessment-form');
const statusBox = document.getElementById('assessment-status');
const heading = document.getElementById('assessment-heading');
const copy = document.getElementById('assessment-copy');

logoutButton.addEventListener('click', logout);

let questionnaires = [];
let selectedQuestionnaireId = 'pfads-full';
let selectedQuestionnaire = null;
let selectedScale = [];
let renderedQuestions = [];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderQuestionnaireSelector() {
  selector.innerHTML = questionnaires
    .map(
      (questionnaire) => `
        <button
          class="${questionnaire.id === selectedQuestionnaireId ? 'card selected-card' : 'card'}"
          type="button"
          data-questionnaire-id="${questionnaire.id}"
        >
          <div class="button-row">
            <span class="pill low">${questionnaire.questionCount} questions</span>
            <span class="small muted">${questionnaire.sectionCount} section${questionnaire.sectionCount > 1 ? 's' : ''}</span>
          </div>
          <h3>${escapeHtml(questionnaire.title)}</h3>
          <p>${escapeHtml(questionnaire.description)}</p>
        </button>
      `
    )
    .join('');

  selector.querySelectorAll('[data-questionnaire-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      selectedQuestionnaireId = button.dataset.questionnaireId;
      statusBox.textContent = '';
      await loadQuestionnaire(selectedQuestionnaireId);
    });
  });
}

function renderQuestions(questionnaire, scale) {
  selectedQuestionnaire = questionnaire;
  renderedQuestions = questionnaire.sections.flatMap((section) => section.questions);
  heading.textContent = questionnaire.title;
  copy.textContent = questionnaire.description;

  content.innerHTML = questionnaire.sections
    .map(
      (section) => `
        <section class="card">
          <div class="section-header">
            <div>
              <h2 class="section-title">${escapeHtml(section.id)}. ${escapeHtml(section.title)}</h2>
              <p class="section-copy">Choose one option for each statement.</p>
            </div>
          </div>
          <div class="question-group">
            ${section.questions
              .map(
                (question) => `
                  <div class="question-card">
                    <div class="question-meta">
                      <strong>Q${question.id}</strong>
                      <span class="small muted">${escapeHtml(section.title)}</span>
                    </div>
                    <p>${escapeHtml(question.prompt)}</p>
                    <div class="scale-row">
                      ${scale
                        .map(
                          (option) => `
                            <label class="scale-option">
                              <input type="radio" name="q-${question.id}" value="${option.value}" required />
                              <div>${option.value}</div>
                              <span class="small muted">${escapeHtml(option.label)}</span>
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

async function loadQuestionnaire(questionnaireId) {
  const data = await apiFetch(`/api/students/questions?questionnaireId=${encodeURIComponent(questionnaireId)}`, {
    auth: false
  });
  questionnaires = data.questionnaires || questionnaires;
  selectedScale = data.scale || [];
  selectedQuestionnaire = data.selectedQuestionnaire;
  selectedQuestionnaireId = selectedQuestionnaire.id;
  renderQuestionnaireSelector();
  renderQuestions(selectedQuestionnaire, selectedScale);
}

async function loadAssessmentLibrary() {
  const data = await apiFetch('/api/students/questions', { auth: false });
  questionnaires = data.questionnaires || [];
  await loadQuestionnaire(selectedQuestionnaireId || data.selectedQuestionnaire?.id || 'pfads-full');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(form);
    const answers = renderedQuestions.map((question) => ({
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
      body: {
        questionnaireId: selectedQuestionnaire.id,
        answers
      }
    });

    const scoreLabel =
      result.score?.normalizedTotalScore && selectedQuestionnaire.type !== 'pfads_full'
        ? `${result.score.totalScore} raw / ${result.score.normalizedTotalScore} normalized`
        : `${result.score.totalScore}`;

    statusBox.textContent = `Saved ${selectedQuestionnaire.title}. Score: ${scoreLabel}. Redirecting to dashboard...`;
    showToast('Assessment submitted successfully');
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 1200);
  } catch (error) {
    statusBox.textContent = error.message;
  }
});

loadAssessmentLibrary().catch((error) => {
  statusBox.textContent = error.message;
});

startStudentSessionTracking('assessment');
