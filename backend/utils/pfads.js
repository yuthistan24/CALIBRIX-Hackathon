const pfadsQuestions = require('../data/pfadsQuestions');
const { getQuestionnaireById, OTHER_QUESTIONS } = require('../data/questionnaireCatalog');

const SECTION_NAMES = {
  A: 'Emotional Distress',
  B: 'Academic Self Efficacy',
  C: 'School Belongingness',
  D: 'Family Emotional Climate',
  E: 'Coping & Resilience'
};

const RISK_FACTOR_NAMES = {
  A: 'Emotional Distress',
  B: 'Academic Helplessness',
  C: 'Social Belonging Issues',
  D: 'Family Stress Dominant',
  E: 'Coping Resilience Deficit'
};

const questionMap = new Map(pfadsQuestions.map((question) => [question.id, question]));
const otherQuestionMap = new Map(OTHER_QUESTIONS.map((question) => [question.id, question]));

function getRiskLevel(totalScore) {
  if (totalScore <= 100) {
    return 'Low psychological influence';
  }
  if (totalScore <= 150) {
    return 'Mild influence';
  }
  if (totalScore <= 200) {
    return 'Moderate influence';
  }
  return 'High influence';
}

function calculatePfadsScores(answers) {
  if (!Array.isArray(answers) || answers.length !== 50) {
    throw new Error('PFADS requires exactly 50 answers');
  }

  const sectionScores = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let totalScore = 0;

  for (const answer of answers) {
    if (!sectionScores.hasOwnProperty(answer.section)) {
      throw new Error(`Invalid section ${answer.section}`);
    }
    const question = questionMap.get(Number(answer.questionId));
    if (!question) {
      throw new Error(`Unknown question ${answer.questionId}`);
    }

    const normalizedValue = question.reverse ? 6 - Number(answer.value) : Number(answer.value);
    sectionScores[answer.section] += normalizedValue;
    totalScore += normalizedValue;
  }

  return {
    totalScore,
    sectionScores,
    riskLevel: getRiskLevel(totalScore)
  };
}

function getNormalizedRiskLevel(rawScore, answerCount) {
  if (!answerCount) {
    throw new Error('Answer count is required');
  }

  const normalizedTotalScore = Math.round((Number(rawScore || 0) / answerCount) * 50);
  return {
    normalizedTotalScore,
    riskLevel: getRiskLevel(normalizedTotalScore)
  };
}

function calculateQuestionnaireResult(questionnaireId, answers) {
  const questionnaire = getQuestionnaireById(questionnaireId);
  const expectedQuestions = questionnaire.sections.flatMap((section) => section.questions);
  if (!Array.isArray(answers) || answers.length !== expectedQuestions.length) {
    throw new Error(`${questionnaire.title} requires exactly ${expectedQuestions.length} answers`);
  }

  if (questionnaire.type === 'pfads_full') {
    return {
      questionnaire,
      kind: 'pfads_full',
      ...calculatePfadsScores(answers)
    };
  }

  const questionLookup = questionnaire.type === 'others' ? otherQuestionMap : questionMap;
  const sectionScores = { A: 0, B: 0, C: 0, D: 0, E: 0, O: 0 };
  let totalScore = 0;

  for (const answer of answers) {
    const question = questionLookup.get(Number(answer.questionId));
    if (!question) {
      throw new Error(`Unknown question ${answer.questionId}`);
    }

    const rawValue = Number(answer.value);
    const normalizedValue = question.reverse ? 6 - rawValue : rawValue;
    if (!Number.isFinite(normalizedValue) || normalizedValue < 1 || normalizedValue > 5) {
      throw new Error(`Invalid answer value for question ${answer.questionId}`);
    }

    sectionScores[question.section] += normalizedValue;
    totalScore += normalizedValue;
  }

  const normalized = getNormalizedRiskLevel(totalScore, answers.length);
  return {
    questionnaire,
    kind: questionnaire.type,
    totalScore,
    normalizedTotalScore: normalized.normalizedTotalScore,
    sectionScores,
    riskLevel: normalized.riskLevel
  };
}

function rankedFactorsFromSections(sectionScores) {
  return Object.entries(sectionScores)
    .map(([section, score]) => ({
      factor: RISK_FACTOR_NAMES[section],
      score
    }))
    .sort((left, right) => right.score - left.score);
}

module.exports = {
  SECTION_NAMES,
  RISK_FACTOR_NAMES,
  calculatePfadsScores,
  calculateQuestionnaireResult,
  rankedFactorsFromSections,
  getRiskLevel,
  getNormalizedRiskLevel
};
