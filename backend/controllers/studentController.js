const pfadsQuestions = require('../data/pfadsQuestions');
const hospitals = require('../data/hospitals');
const resilienceResources = require('../data/resilienceResources');
const asyncHandler = require('../utils/asyncHandler');
const { calculatePfadsScores } = require('../utils/pfads');
const Student = require('../models/Student');
const PfadsResponse = require('../models/PfadsResponse');
const PfadsScore = require('../models/PfadsScore');
const ClusterResult = require('../models/ClusterResult');
const PredictionResult = require('../models/PredictionResult');
const Appointment = require('../models/Appointment');
const Alert = require('../models/Alert');
const SentimentLog = require('../models/SentimentLog');
const ChatMessage = require('../models/ChatMessage');
const { clusterPsychology, predictDropout, analyzeSentiment, generateChatResponse } = require('../services/aiService');
const { assignCounselor } = require('../services/counselorAssignmentService');
const { evaluateAssessmentAlerts, evaluateSentimentAlerts } = require('../services/alertService');
const Counselor = require('../models/Counselor');

function recommendHospitals(district) {
  return hospitals.filter((entry) => entry.district === district || entry.district === 'Default');
}

function buildResilienceBadges(score, streak, badges) {
  const nextBadges = new Set(badges);
  if (score >= 20) {
    nextBadges.add('Grounded Starter');
  }
  if (streak >= 3) {
    nextBadges.add('Three Day Reset');
  }
  if (score >= 60) {
    nextBadges.add('Resilience Builder');
  }
  return Array.from(nextBadges);
}

async function rollback(steps) {
  for (const step of steps.reverse()) {
    try {
      await step();
    } catch (_error) {
      // Best-effort cleanup for standalone MongoDB deployments.
    }
  }
}

const getQuestions = asyncHandler(async (_req, res) => {
  res.json({
    questionnaire: pfadsQuestions,
    scale: [
      { value: 1, label: 'Strongly Disagree' },
      { value: 2, label: 'Disagree' },
      { value: 3, label: 'Neutral' },
      { value: 4, label: 'Agree' },
      { value: 5, label: 'Strongly Agree' }
    ]
  });
});

const submitAssessment = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId);
  const answers = req.body.answers;
  const pfads = calculatePfadsScores(answers);
  const cluster = await clusterPsychology(pfads.sectionScores);
  const prediction = await predictDropout({
    totalScore: pfads.totalScore,
    sectionScores: pfads.sectionScores,
    sentimentScore: student.latestSentimentScore || 0,
    historicalEngagement: student.historicalEngagement,
    assessmentCompletionPatterns: student.assessmentCompletionPatterns
  });

  let responseDoc;
  let scoreDoc;
  let clusterDoc;
  let predictionDoc;
  const rollbackSteps = [];

  try {
    responseDoc = await PfadsResponse.create({
      student: student._id,
      answers
    });
    rollbackSteps.push(() => PfadsResponse.deleteOne({ _id: responseDoc._id }));

    scoreDoc = await PfadsScore.create({
      student: student._id,
      response: responseDoc._id,
      totalScore: pfads.totalScore,
      sectionScores: pfads.sectionScores,
      riskLevel: pfads.riskLevel
    });
    rollbackSteps.push(() => PfadsScore.deleteOne({ _id: scoreDoc._id }));

    clusterDoc = await ClusterResult.create({
      student: student._id,
      pfadsScore: scoreDoc._id,
      clusterId: cluster.clusterId,
      clusterLabel: cluster.clusterLabel,
      dominantFactor: cluster.dominantFactor,
      rankedFactors: cluster.rankedFactors,
      centroidDistances: cluster.centroidDistances
    });
    rollbackSteps.push(() => ClusterResult.deleteOne({ _id: clusterDoc._id }));

    predictionDoc = await PredictionResult.create({
      student: student._id,
      pfadsScore: scoreDoc._id,
      probability: prediction.probability,
      riskLevel: prediction.riskLevel,
      featureSnapshot: {
        sentimentScore: student.latestSentimentScore || 0,
        historicalEngagement: student.historicalEngagement,
        assessmentCompletionPatterns: student.assessmentCompletionPatterns
      }
    });
    rollbackSteps.push(() => PredictionResult.deleteOne({ _id: predictionDoc._id }));

    student.lastAssessmentAt = new Date();
    student.dominantRisk = cluster.dominantFactor;
    await student.save();
  } catch (error) {
    await rollback(rollbackSteps);
    throw error;
  }

  const io = req.app.get('io');
  const latestAppointment = await Appointment.findOne({ student: student._id }).sort({ createdAt: -1 }).lean();
  await evaluateAssessmentAlerts({
    studentId: student._id,
    counselorId: latestAppointment?.counselor,
    pfadsScore: scoreDoc,
    prediction,
    io
  });

  res.status(201).json({
    message: 'PFADS assessment submitted successfully',
    score: scoreDoc,
    cluster: clusterDoc,
    prediction: predictionDoc
  });
});

const getDashboard = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId).lean();
  const [latestScore, latestCluster, latestPrediction, appointments, sentiments, alerts] = await Promise.all([
    PfadsScore.findOne({ student: student._id }).sort({ createdAt: -1 }).lean(),
    ClusterResult.findOne({ student: student._id }).sort({ createdAt: -1 }).lean(),
    PredictionResult.findOne({ student: student._id }).sort({ createdAt: -1 }).lean(),
    Appointment.find({ student: student._id }).populate('counselor', 'name specialization district email').sort({ createdAt: -1 }).lean(),
    SentimentLog.find({ student: student._id }).sort({ createdAt: -1 }).limit(12).lean(),
    Alert.find({ student: student._id, resolved: false }).sort({ createdAt: -1 }).lean()
  ]);

  res.json({
    student,
    latestScore,
    latestCluster,
    latestPrediction,
    appointments,
    sentiments,
    alerts,
    resilienceResources,
    hospitalRecommendations: recommendHospitals(student.district)
  });
});

const requestAppointment = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId);
  const specializationNeed = req.body.specializationNeed || student.dominantRisk;
  const counselor = await assignCounselor({
    specializationNeed,
    district: student.district
  });

  let appointment;
  let incrementedCounselor = false;
  try {
    appointment = await Appointment.create({
      student: student._id,
      counselor: counselor._id,
      specializationNeed,
      district: student.district,
      preferredDate: new Date(req.body.preferredDate),
      notes: req.body.notes || ''
    });

    await Counselor.updateOne({ _id: counselor._id }, { $inc: { activeSessions: 1 } });
    incrementedCounselor = true;
  } catch (error) {
    if (appointment?._id) {
      await Appointment.deleteOne({ _id: appointment._id }).catch(() => {});
    }
    if (incrementedCounselor) {
      await Counselor.updateOne(
        { _id: counselor._id, activeSessions: { $gt: 0 } },
        { $inc: { activeSessions: -1 } }
      ).catch(() => {});
    }
    throw error;
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`user:${counselor._id.toString()}`).emit('appointments:new', appointment);
  }

  res.status(201).json({
    message: 'Counseling request assigned successfully',
    appointment,
    counselor
  });
});

const getResources = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId).lean();
  res.json({
    resilienceResources,
    hospitalRecommendations: recommendHospitals(student.district)
  });
});

const postAiChat = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId);
  const message = String(req.body.message || '').trim();
  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  const sentiment = await analyzeSentiment(message);
  const chatReply = await generateChatResponse({
    message,
    studentContext: {
      dominantRisk: student.dominantRisk,
      district: student.district
    }
  });

  const roomId = `ai:${student._id.toString()}`;
  await Promise.all([
    ChatMessage.create({
      roomId,
      student: student._id,
      senderRole: 'student',
      senderId: student._id.toString(),
      recipientId: 'ai-assistant',
      message,
      sentiment
    }),
    ChatMessage.create({
      roomId,
      student: student._id,
      senderRole: 'ai',
      senderId: 'ai-assistant',
      recipientId: student._id.toString(),
      message: chatReply.reply
    }),
    SentimentLog.create({
      student: student._id,
      sourceType: 'ai_chat',
      message,
      sentimentScore: sentiment.score,
      label: sentiment.label,
      stressIndicator: sentiment.stressIndicator
    })
  ]);

  student.latestSentimentScore = sentiment.score;
  await student.save();

  const io = req.app.get('io');
  await evaluateSentimentAlerts({
    studentId: student._id,
    sentiment,
    sourceType: 'ai_chat',
    io
  });

  res.json({
    sentiment,
    chat: chatReply
  });
});

const updateResilienceProgress = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId);
  const resource = resilienceResources.find((entry) => entry.id === req.body.activityId);
  if (!resource) {
    return res.status(404).json({ message: 'Activity not found' });
  }

  const now = new Date();
  const lastActivity = student.lastResilienceActivityAt ? new Date(student.lastResilienceActivityAt) : null;
  const isConsecutiveDay =
    lastActivity && Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24)) === 1;

  student.dailyResilienceScore = Math.min(100, student.dailyResilienceScore + resource.points);
  student.resilienceStreak = isConsecutiveDay ? student.resilienceStreak + 1 : Math.max(student.resilienceStreak, 1);
  student.lastResilienceActivityAt = now;
  student.achievementBadges = buildResilienceBadges(
    student.dailyResilienceScore,
    student.resilienceStreak,
    student.achievementBadges
  );
  await student.save();

  res.json({
    message: 'Resilience progress updated',
    dailyResilienceScore: student.dailyResilienceScore,
    resilienceStreak: student.resilienceStreak,
    achievementBadges: student.achievementBadges
  });
});

const getEmotionTimeline = asyncHandler(async (req, res) => {
  const sentiments = await SentimentLog.find({ student: req.user.userId })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  res.json({
    sentiments: sentiments.reverse()
  });
});

module.exports = {
  getQuestions,
  submitAssessment,
  getDashboard,
  requestAppointment,
  getResources,
  postAiChat,
  updateResilienceProgress,
  getEmotionTimeline
};
