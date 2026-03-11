const axios = require('axios');

const env = require('../config/env');
const { rankedFactorsFromSections } = require('../utils/pfads');

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function localSentiment(message = '') {
  const positiveWords = ['calm', 'hopeful', 'better', 'good', 'supported', 'strong', 'relaxed'];
  const negativeWords = ['sad', 'anxious', 'hopeless', 'stressed', 'overwhelmed', 'tired', 'panic'];
  const stressWords = ['dropout', 'fail', 'worthless', 'alone', 'panic', 'crying', 'suicide'];

  const tokens = message.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const positiveCount = tokens.filter((token) => positiveWords.includes(token)).length;
  const negativeCount = tokens.filter((token) => negativeWords.includes(token)).length;
  const stressCount = tokens.filter((token) => stressWords.includes(token)).length;
  const rawScore = (positiveCount - negativeCount - stressCount * 1.5) / Math.max(tokens.length, 1);
  const stressIndicator = Math.min(1, (negativeCount + stressCount * 2) / Math.max(tokens.length, 4));
  const score = Math.max(-1, Math.min(1, rawScore * 6));
  const label = score > 0.2 ? 'Positive' : score < -0.2 ? 'Negative' : 'Neutral';

  return {
    score,
    label,
    stressIndicator
  };
}

function localCluster(sectionScores) {
  const rankedFactors = rankedFactorsFromSections(sectionScores);
  const factorClusterMap = {
    'Emotional Distress': { clusterId: 1, clusterLabel: 'Emotional distress dominant' },
    'Academic Helplessness': { clusterId: 2, clusterLabel: 'Academic helplessness' },
    'Family Stress Dominant': { clusterId: 3, clusterLabel: 'Family stress dominant' },
    'Social Belonging Issues': { clusterId: 4, clusterLabel: 'Social belonging issues' },
    'Coping Resilience Deficit': { clusterId: 5, clusterLabel: 'Coping resilience deficit' }
  };
  const primary = factorClusterMap[rankedFactors[0].factor];
  return {
    clusterId: primary.clusterId,
    clusterLabel: primary.clusterLabel,
    dominantFactor: rankedFactors[0].factor,
    rankedFactors,
    centroidDistances: rankedFactors.map((factor) => Math.max(0, 50 - factor.score))
  };
}

function localPrediction(input) {
  const totalNormalized = input.totalScore / 250;
  const sentimentPenalty = Math.max(0, -input.sentimentScore);
  const lowEngagementPenalty = 1 - input.historicalEngagement;
  const completionPenalty = 1 - input.assessmentCompletionPatterns;
  const sectionPressure = Math.max(...Object.values(input.sectionScores)) / 50;
  const linearScore =
    totalNormalized * 2.3 +
    sentimentPenalty * 1.6 +
    lowEngagementPenalty * 1.1 +
    completionPenalty * 0.9 +
    sectionPressure * 1.2 -
    2.6;
  const probability = sigmoid(linearScore);
  const riskLevel = probability >= 0.75 ? 'High risk' : probability >= 0.45 ? 'Medium risk' : 'Low risk';

  return {
    probability,
    riskLevel
  };
}

function localChat(payload) {
  const sentiment = localSentiment(payload.message);
  const copingStrategies = [
    'Take a 2 minute breathing pause before the next task.',
    'Write one stress trigger and one small next step in a journal.',
    'Reach out to a counselor if the pressure feels unmanageable.'
  ];
  const supportiveLead =
    sentiment.label === 'Negative'
      ? 'It sounds like this is feeling heavy right now.'
      : 'Thank you for sharing that.';

  return {
    reply: `${supportiveLead} What feels most difficult at this moment: your emotions, coursework, belonging, family pressure, or coping?`,
    copingStrategies,
    escalate: sentiment.stressIndicator >= 0.7
  };
}

async function postToAiService(path, payload) {
  const url = `${env.aiServiceUrl}${path}`;
  const response = await axios.post(url, payload, {
    timeout: 3000,
    headers: { 'Content-Type': 'application/json' }
  });
  return response.data;
}

async function analyzeSentiment(message) {
  try {
    return await postToAiService('/sentiment', { message });
  } catch (_error) {
    return localSentiment(message);
  }
}

async function clusterPsychology(sectionScores) {
  try {
    return await postToAiService('/cluster', { sectionScores });
  } catch (_error) {
    return localCluster(sectionScores);
  }
}

async function predictDropout(payload) {
  try {
    return await postToAiService('/predict', payload);
  } catch (_error) {
    return localPrediction(payload);
  }
}

async function generateChatResponse(payload) {
  try {
    return await postToAiService('/chat', payload);
  } catch (_error) {
    return localChat(payload);
  }
}

module.exports = {
  analyzeSentiment,
  clusterPsychology,
  predictDropout,
  generateChatResponse
};
