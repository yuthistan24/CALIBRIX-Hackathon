const axios = require('axios');

const env = require('../config/env');
const { rankedFactorsFromSections } = require('../utils/pfads');
const { generateMentorReply } = require('./llmService');
const { recommendMedia } = require('./mediaRecommendationService');
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

function pickVariant(options = []) {
  if (!Array.isArray(options) || !options.length) {
    return '';
  }
  return options[Math.floor(Math.random() * options.length)];
}

function inferChatTopic(message) {
  const lowered = String(message || '').toLowerCase();
  for (const [topic, config] of Object.entries(CHAT_TOPICS)) {
    if (config.keywords.some((keyword) => lowered.includes(keyword))) {
      return topic;
    }
  }
  return 'emotional';
}

function isGreetingMessage(message = '') {
  const normalized = String(message || '')
    .trim()
    .toLowerCase()
    .replace(/[.!?,]/g, '');
  if (!normalized) {
    return false;
  }

  const greetings = new Set([
    'hi',
    'hello',
    'hey',
    'yo',
    'hii',
    'heyy',
    'hola',
    'namaste',
    'salaam',
    'assalamualaikum',
    'good morning',
    'good afternoon',
    'good evening'
  ]);

  if (greetings.has(normalized)) {
    return true;
  }

  return normalized.length <= 6 && (normalized === 'hi there' || normalized === 'hello there');
}

function greetingReply(payload) {
  const steps = [
    'Pick one topic: studies / stress / loneliness / sleep / motivation.',
    'Tell me what’s happening in 1–2 sentences.',
    'Tell me what you want by the end of this chat (calm down / plan / talk it out / resources).'
  ];
  const followUpQuestion = 'Which topic should we start with?';

  return {
    reply: `Hi — quick start: ${steps.map((step, index) => `${index + 1}) ${step}`).join(' ')} Question: ${followUpQuestion}`,
    copingStrategies: steps.slice(0, 3),
    escalate: false,
    topic: 'check-in',
    alertSeverity: 'low',
    escalationReason: '',
    followUpQuestion,
    provider: 'heuristic',
    model: 'mindguard-local',
    source: 'heuristic'
  };
}

function localChat(payload) {
  const messageText = String(payload.message || '').trim();
  if (isGreetingMessage(messageText)) {
    const copingStrategies = [
      'In one sentence, tell me what you want help with (stress, studies, loneliness, sleep, motivation).',
      'Pick a starting area: stress / studies / loneliness / sleep / motivation.',
      'Rate it from 1 to 10 right now.'
    ];
    const followUpQuestion = 'What would you like help with right now?';
    return {
      reply: `Hi. ${copingStrategies.map((step, index) => `${index + 1}) ${step}`).join(' ')} Question: ${followUpQuestion}`,
      copingStrategies,
      escalate: false,
      topic: 'support',
      alertSeverity: 'low',
      escalationReason: '',
      followUpQuestion,
      provider: 'heuristic',
      model: 'mindguard-local'
    };
  }

  const sentiment = localSentiment(payload.message);
  const topic = inferChatTopic(payload.message);
  const config = CHAT_TOPICS[topic];
  const guidance = retrieveRelevantGuidance({
    message: payload.message,
    studentContext: {}
  })[0];

  const followUp = pickVariant(config.questions) || 'What would feel like a small win in the next hour?';

  const guidanceLine = guidance?.guidance ? guidance.guidance : '';
  const copingStrategies = guidance?.supportSteps?.length ? guidance.supportSteps.slice(0, 3) : config.strategies;

  return {
    reply: [
      guidanceLine,
      `Try: ${copingStrategies
        .slice(0, 3)
        .map((step, index) => `${index + 1}) ${step}`)
        .join(' ')}`,
      `Question: ${followUp}`
    ]
      .filter(Boolean)
      .join(' ')
      .trim(),
    copingStrategies: copingStrategies.slice(0, 4),
    escalate: sentiment.stressIndicator >= 0.7,
    topic: config.label,
    alertSeverity:
      sentiment.stressIndicator >= 0.82
        ? 'high'
        : sentiment.label === 'Negative'
          ? 'moderate'
          : 'low',
    escalationReason:
      sentiment.stressIndicator >= 0.7
        ? 'Strong distress language or stress signals were detected in the latest student message.'
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

function withTimeout(promise, timeoutMs = 0) {
  const limit = Number(timeoutMs);
  if (!limit || limit <= 0) {
    return promise;
  }

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('LLM request timed out')), limit);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function generateChatResponse(payload) {
  const topicKey = inferChatTopic(payload?.message);
  if (isGreetingMessage(payload?.message)) {
    return {
      ...greetingReply(payload),
      recommendedActivities: recommendMedia({
        topicKey,
        sentimentLabel: payload?.sentiment?.label,
        language: payload?.language
      })
    };
  }

  try {
    const llmReply = await withTimeout(generateMentorReply(payload), env.llm?.chatTimeoutMs || 25000);
    if (llmReply) {
      return {
        ...llmReply,
        recommendedActivities: recommendMedia({
          topicKey,
          sentimentLabel: payload?.sentiment?.label,
          language: payload?.language
        })
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
      source: response.source || 'ai_service',
      recommendedActivities: recommendMedia({
        topicKey,
        sentimentLabel: payload?.sentiment?.label,
        language: payload?.language
      })
    };
  } catch (_error) {
    return {
      ...localChat(payload),
      provider: 'heuristic',
      model: 'mindguard-local',
      source: 'heuristic',
      recommendedActivities: recommendMedia({
        topicKey,
        sentimentLabel: payload?.sentiment?.label,
        language: payload?.language
      })
    };
  }
}

module.exports = {
  analyzeSentiment,
  clusterPsychology,
  predictDropout,
  generateChatResponse
};
