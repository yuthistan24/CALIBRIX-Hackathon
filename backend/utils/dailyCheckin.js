const dailyCheckinQuestions = require('../data/dailyCheckinQuestions');

const RESPONSE_SCORES = {
  mood: {
    very_happy: 0,
    happy: 1,
    neutral: 2,
    sad: 4,
    very_sad: 5
  },
  stress: {
    not_stressed: 0,
    slightly_stressed: 2,
    moderately_stressed: 4,
    very_stressed: 5
  },
  study_motivation: {
    very_motivated: 0,
    somewhat_motivated: 2,
    not_motivated: 5
  },
  sleep_quality: {
    very_well: 0,
    average: 2,
    poor: 5
  },
  energy_level: {
    high_energy: 0,
    normal_energy: 2,
    low_energy: 4
  },
  academic_pressure: {
    yes_a_lot: 5,
    a_little: 2,
    not_at_all: 0
  },
  social_interaction: {
    yes: 0,
    no: 3
  },
  anxiety: {
    not_at_all: 0,
    sometimes: 2,
    often: 5
  },
  confidence: {
    very_confident: 0,
    somewhat_confident: 2,
    not_confident: 5
  },
  giving_up: {
    yes: 5,
    sometimes: 3,
    no: 0
  }
};

function getDateKey(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function validateDailyCheckinResponses(responses) {
  for (const question of dailyCheckinQuestions) {
    const answer = responses[question.key];
    if (question.type === 'text') {
      if (!String(answer || '').trim()) {
        throw new Error(`Missing answer for ${question.prompt}`);
      }
      continue;
    }

    const allowedValues = new Set(question.options.map((option) => option.value));
    if (!allowedValues.has(answer)) {
      throw new Error(`Invalid answer for ${question.prompt}`);
    }
  }
}

function calculateDailyCheckinMetrics(responses, challengeSentiment) {
  validateDailyCheckinResponses(responses);

  const flags = [];
  let riskScore = 0;

  for (const [key, scoreMap] of Object.entries(RESPONSE_SCORES)) {
    riskScore += scoreMap[responses[key]] || 0;
  }

  const challengePenalty = Math.round(
    (challengeSentiment.stressIndicator || 0) * 6 +
      (challengeSentiment.label === 'Negative' ? 2 : 0)
  );
  riskScore += challengePenalty;

  if (responses.giving_up === 'yes') {
    flags.push('Expressed desire to give up studies');
  } else if (responses.giving_up === 'sometimes') {
    flags.push('Intermittent thoughts of giving up');
  }

  if (responses.mood === 'very_sad' || responses.stress === 'very_stressed') {
    flags.push('Acute emotional strain today');
  }

  if (responses.sleep_quality === 'poor' && responses.energy_level === 'low_energy') {
    flags.push('Poor sleep and low energy pattern');
  }

  if (responses.study_motivation === 'not_motivated' || responses.confidence === 'not_confident') {
    flags.push('Reduced academic momentum');
  }

  if (responses.social_interaction === 'no') {
    flags.push('Low social contact today');
  }

  if (challengeSentiment.label === 'Negative' && challengeSentiment.stressIndicator >= 0.6) {
    flags.push('Challenge narrative indicates distress');
  }

  const maxRisk = 49;
  const wellbeingScore = Math.max(0, Math.round((1 - riskScore / maxRisk) * 100));
  const riskLevel = riskScore >= 30 ? 'High concern' : riskScore >= 16 ? 'Moderate concern' : 'Stable';

  return {
    riskScore,
    wellbeingScore,
    riskLevel,
    flags
  };
}

module.exports = {
  dailyCheckinQuestions,
  getDateKey,
  validateDailyCheckinResponses,
  calculateDailyCheckinMetrics
};
