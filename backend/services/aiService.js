const axios = require('axios');

const env = require('../config/env');
const { rankedFactorsFromSections } = require('../utils/pfads');
const { generateMentorReply } = require('./llmService');
const { retrieveRelevantGuidance } = require('./psychologyKnowledgeService');

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

const CHAT_TOPICS = {
  academic: {
    label: 'coursework pressure',
    keywords: ['study', 'studies', 'exam', 'assignment', 'deadline', 'grade', 'class', 'course', 'fail'],
    strategies: [
      'Pick the smallest academic task you can finish in 10 minutes.',
      'Break one deadline into three visible sub-steps and start the first one only.',
      'Send one concrete question to a lecturer, tutor, or classmate today.'
    ],
    questions: [
      'Which academic task feels most stuck right now?',
      'What is the smallest study action you could complete in the next 15 minutes?',
      'Is the pressure coming more from workload, fear of failure, or concentration?' 
    ]
  },
  emotional: {
    label: 'emotional strain',
    keywords: ['sad', 'down', 'cry', 'empty', 'hopeless', 'heavy', 'upset', 'depressed'],
    strategies: [
      'Name the feeling directly and rate its intensity from 1 to 10.',
      'Take a slow 4-4-6 breathing cycle for two minutes.',
      'Stay with one grounding detail you can see, hear, and feel right now.'
    ],
    questions: [
      'Did this feeling build gradually today or hit suddenly?',
      'What triggered the heaviest part of this emotion?',
      'Would it help to focus first on calming your body or organizing the problem?' 
    ]
  },
  anxiety: {
    label: 'anxiety and worry',
    keywords: ['anxious', 'panic', 'worried', 'worry', 'nervous', 'fear', 'afraid', 'overthinking'],
    strategies: [
      'Write down the worst-case thought and one more realistic alternative.',
      'Slow your breathing and unclench your shoulders before the next task.',
      'Reduce the next decision to one immediate step instead of the whole problem.'
    ],
    questions: [
      'What thought keeps looping the most right now?',
      'Is your anxiety more about performance, relationships, or uncertainty?',
      'What would make the next hour feel 10 percent safer?' 
    ]
  },
  social: {
    label: 'belonging and connection',
    keywords: ['alone', 'lonely', 'friend', 'friends', 'family', 'ignored', 'isolated', 'belong'],
    strategies: [
      'Message one trusted person with a simple honest check-in.',
      'Choose one low-pressure social contact instead of waiting for energy to appear.',
      'Write down one place or person that feels safest to approach.'
    ],
    questions: [
      'Are you feeling more disconnected from friends, family, or campus life?',
      'Who feels safest to contact, even briefly?',
      'Did something specific happen today that made you feel left out?' 
    ]
  },
  family: {
    label: 'family pressure',
    keywords: ['home', 'family', 'parents', 'mother', 'father', 'house', 'conflict'],
    strategies: [
      'Protect one short study block away from conflict if possible.',
      'Write one sentence you can use to ask for space or support calmly.',
      'Separate what is under your control tonight from what is not.'
    ],
    questions: [
      'Is the hardest part expectation, conflict, or lack of support?',
      'What boundary would make today feel slightly more manageable?',
      'Do you need help planning around the home situation or talking about the feelings from it?' 
    ]
  },
  sleep: {
    label: 'sleep and energy strain',
    keywords: ['sleep', 'slept', 'tired', 'exhausted', 'energy', 'fatigue'],
    strategies: [
      'Lower the difficulty of your next task to match today\'s energy instead of forcing full intensity.',
      'Plan one recovery break before starting anything mentally heavy.',
      'Avoid stacking multiple demanding tasks without a pause today.'
    ],
    questions: [
      'Is low energy affecting concentration, mood, or both?',
      'What task can be simplified instead of postponed completely?',
      'Do you want help making a low-energy study plan for today?' 
    ]
  }
};

function hashSeed(value = '') {
  return Array.from(value).reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function pickVariant(options, seed) {
  return options[hashSeed(seed) % options.length];
}

function inferChatTopic(message, dominantRisk = '') {
  const lowered = String(message || '').toLowerCase();
  for (const [topic, config] of Object.entries(CHAT_TOPICS)) {
    if (config.keywords.some((keyword) => lowered.includes(keyword))) {
      return topic;
    }
  }

  if (dominantRisk.includes('Academic')) {
    return 'academic';
  }
  if (dominantRisk.includes('Family')) {
    return 'family';
  }
  if (dominantRisk.includes('Social')) {
    return 'social';
  }
  if (dominantRisk.includes('Coping')) {
    return 'sleep';
  }
  return 'emotional';
}

function localChat(payload) {
  const sentiment = localSentiment(payload.message);
  const studentContext = payload.studentContext || {};
  const topic = inferChatTopic(payload.message, studentContext.dominantRisk || '');
  const config = CHAT_TOPICS[topic];
  const guidance = retrieveRelevantGuidance({
    message: payload.message,
    studentContext
  })[0];
  const chatHistory = payload.chatHistory || [];
  const assistantTurns = chatHistory.filter((entry) => entry.role === 'assistant').length;

  const reflection =
    sentiment.label === 'Negative'
      ? `You sound pulled down by ${config.label} right now.`
      : sentiment.label === 'Positive'
        ? `There is some stability in what you shared, even with ${config.label} present.`
        : `I can hear that ${config.label} is part of today.`;

  const contextNote =
    studentContext.latestCheckinRisk === 'High concern'
      ? 'Your latest daily check-in also suggests today has been especially heavy.'
      : studentContext.dropoutRisk === 'High risk'
        ? 'Given your recent risk pattern, it is worth keeping the next step very small and specific.'
        : '';

  const followUp =
    assistantTurns === 0
      ? pickVariant(config.questions, payload.message)
      : assistantTurns === 1
        ? `On a scale from 1 to 10, how intense is this ${config.label} right now?`
        : `What is one realistic action you could take in the next hour to reduce this ${config.label} a little?`;

  const guidanceLine = guidance?.guidance ? guidance.guidance : '';
  const copingStrategies = guidance?.supportSteps?.length ? guidance.supportSteps.slice(0, 3) : config.strategies;

  return {
    reply: [reflection, contextNote, guidanceLine, followUp].filter(Boolean).join(' '),
    copingStrategies,
    escalate: sentiment.stressIndicator >= 0.7 || studentContext.latestCheckinRisk === 'High concern',
    topic: config.label,
    alertSeverity:
      sentiment.stressIndicator >= 0.82 || studentContext.latestCheckinRisk === 'High concern'
        ? 'high'
        : sentiment.label === 'Negative'
          ? 'moderate'
          : 'low',
    escalationReason:
      sentiment.stressIndicator >= 0.7
        ? 'Strong distress language or stress signals were detected in the latest student message.'
        : studentContext.latestCheckinRisk === 'High concern'
          ? 'The latest daily check-in is already in a high concern band.'
          : '',
    followUpQuestion: followUp,
    provider: 'heuristic',
    model: 'mindguard-local'
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
    const llmReply = await generateMentorReply(payload);
    if (llmReply) {
      return {
        ...llmReply
      };
    }
  } catch (_error) {
    // Fall through to the existing local AI service and heuristic fallback.
  }

  try {
    const response = await postToAiService('/chat', payload);
    return {
      ...response,
      alertSeverity: response.alertSeverity || (response.escalate ? 'moderate' : 'low'),
      escalationReason: response.escalationReason || '',
      followUpQuestion: response.followUpQuestion || '',
      provider: response.provider || 'python_service',
      model: response.model || 'mindguard-ai-service',
      source: response.source || 'ai_service'
    };
  } catch (_error) {
    return {
      ...localChat(payload),
      provider: 'heuristic',
      model: 'mindguard-local',
      source: 'heuristic'
    };
  }
}

module.exports = {
  analyzeSentiment,
  clusterPsychology,
  predictDropout,
  generateChatResponse
};
