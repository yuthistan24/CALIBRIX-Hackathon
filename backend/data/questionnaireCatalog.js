const pfadsQuestions = require('./pfadsQuestions');

const QUESTIONNAIRE_SCALES = {
  agreement: [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly Agree' }
  ],
  frequency: [
    { value: 1, label: 'Never' },
    { value: 2, label: 'Rarely' },
    { value: 3, label: 'Sometimes' },
    { value: 4, label: 'Often' },
    { value: 5, label: 'Very Often' }
  ]
};

const OTHER_QUESTIONS = [
  'Do you feel stressed recently?',
  'Are you struggling to manage your time?',
  'Do you feel isolated?',
  'Are you experiencing sleep problems?',
  'Do you feel anxious frequently?',
  'Do you feel overwhelmed by responsibilities?',
  'Are you losing interest in activities?',
  'Do you feel mentally exhausted?',
  'Do you feel unsupported?',
  'Do you feel like giving up sometimes?'
].map((prompt, index) => ({
  id: 1001 + index,
  section: 'O',
  sectionTitle: 'Other Wellbeing Signals',
  prompt,
  reverse: false
}));

const PFADS_SECTIONS = ['A', 'B', 'C', 'D', 'E'].map((sectionCode) => {
  const sectionQuestions = pfadsQuestions.filter((question) => question.section === sectionCode);
  return {
    id: sectionCode,
    title: sectionQuestions[0]?.sectionTitle || sectionCode,
    questions: sectionQuestions
  };
});

const FULL_PFADS = {
  id: 'pfads-full',
  title: 'Full PFADS Assessment',
  type: 'pfads_full',
  description: 'All 50 PFADS items across sections A to E.',
  sectionCount: 5,
  questionCount: pfadsQuestions.length,
  scaleKey: 'agreement',
  sections: PFADS_SECTIONS
};

const SECTION_QUESTIONNAIRES = PFADS_SECTIONS.map((section) => ({
  id: `pfads-${section.id.toLowerCase()}`,
  title: `${section.id}. ${section.title}`,
  type: 'pfads_section',
  description: `A focused 10-question check on ${section.title.toLowerCase()}.`,
  targetSection: section.id,
  sectionCount: 1,
  questionCount: section.questions.length,
  scaleKey: 'agreement',
  sections: [section]
}));

const OTHERS_QUESTIONNAIRE = {
  id: 'others-check',
  title: 'Others Wellbeing Check',
  type: 'others',
  description: 'A short 10-question screening for stress, anxiety, exhaustion, isolation, and support gaps.',
  targetSection: 'O',
  sectionCount: 1,
  questionCount: OTHER_QUESTIONS.length,
  scaleKey: 'frequency',
  sections: [
    {
      id: 'O',
      title: 'Other Wellbeing Signals',
      questions: OTHER_QUESTIONS
    }
  ]
};

const QUESTIONNAIRE_CATALOG = [FULL_PFADS, ...SECTION_QUESTIONNAIRES, OTHERS_QUESTIONNAIRE];

function getQuestionnaireById(questionnaireId = FULL_PFADS.id) {
  return QUESTIONNAIRE_CATALOG.find((entry) => entry.id === questionnaireId) || FULL_PFADS;
}

function getQuestionnaireSummaries() {
  return QUESTIONNAIRE_CATALOG.map((entry) => ({
    id: entry.id,
    title: entry.title,
    type: entry.type,
    description: entry.description,
    sectionCount: entry.sectionCount,
    questionCount: entry.questionCount,
    targetSection: entry.targetSection || null
  }));
}

module.exports = {
  QUESTIONNAIRE_SCALES,
  QUESTIONNAIRE_CATALOG,
  FULL_PFADS,
  OTHERS_QUESTIONNAIRE,
  OTHER_QUESTIONS,
  getQuestionnaireById,
  getQuestionnaireSummaries
};
