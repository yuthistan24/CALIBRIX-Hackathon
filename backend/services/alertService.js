const Alert = require('../models/Alert');
const SentimentLog = require('../models/SentimentLog');
const Appointment = require('../models/Appointment');

const DUPLICATE_WINDOW_MS = 1000 * 60 * 60 * 6;
const CRISIS_PATTERNS = [
  'suicide',
  'kill myself',
  'self harm',
  'self-harm',
  'end my life',
  'want to die',
  'cannot go on',
  "can't go on",
  'hurt myself'
];

async function hydrateAlert(alertId) {
  return Alert.findById(alertId)
    .populate('student', 'fullName district')
    .populate('counselor', 'name district email mobileNumber')
    .lean();
}

async function resolveCounselorId(studentId, counselorId) {
  if (counselorId) {
    return counselorId;
  }

  const latestAppointment = await Appointment.findOne({ student: studentId })
    .sort({ createdAt: -1 })
    .select('counselor')
    .lean();

  return latestAppointment?.counselor || null;
}

async function emitAlert(io, counselorId, alert) {
  if (!io || !alert) {
    return;
  }

  io.to('role:admin').emit('alerts:new', alert);
  if (counselorId) {
    io.to(`user:${counselorId.toString()}`).emit('alerts:new', alert);
  }
}

async function findOrCreateAlert({ studentId, counselorId, type, severity, title, description, metadata = {}, io }) {
  const linkedCounselorId = await resolveCounselorId(studentId, counselorId);
  const recentDuplicate = await Alert.findOne({
    student: studentId,
    type,
    resolved: false,
    createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) }
  });

  if (recentDuplicate) {
    let changed = false;

    if (!recentDuplicate.counselor && linkedCounselorId) {
      recentDuplicate.counselor = linkedCounselorId;
      changed = true;
    }

    if (metadata && Object.keys(metadata).length) {
      recentDuplicate.metadata = {
        ...(recentDuplicate.metadata || {}),
        ...metadata
      };
      changed = true;
    }

    if (changed) {
      await recentDuplicate.save();
    }

    const hydratedDuplicate = await hydrateAlert(recentDuplicate._id);
    if (changed) {
      await emitAlert(io, hydratedDuplicate?.counselor?._id || linkedCounselorId, hydratedDuplicate);
    }
    return hydratedDuplicate;
  }

  const alert = await Alert.create({
    student: studentId,
    counselor: linkedCounselorId,
    type,
    severity,
    title,
    description,
    metadata
  });

  const hydrated = await hydrateAlert(alert._id);
  await emitAlert(io, linkedCounselorId, hydrated);
  return hydrated;
}

async function countRepeatedNegativePatterns(studentId) {
  const recentLogs = await SentimentLog.find({ student: studentId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const negativeCount = recentLogs.filter((log) => log.label === 'Negative').length;
  const averageStress =
    recentLogs.reduce((sum, log) => sum + Number(log.stressIndicator || 0), 0) / Math.max(recentLogs.length, 1);

  return {
    negativeCount,
    averageStress
  };
}

async function evaluateAssessmentAlerts({ studentId, counselorId, pfadsScore, prediction, io }) {
  const alerts = [];

  if (pfadsScore.totalScore >= 201) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'pfads_high_risk',
        severity: 'high',
        title: 'High PFADS psychological influence',
        description: 'Student recorded a PFADS score within the high influence band.',
        metadata: { totalScore: pfadsScore.totalScore },
        io
      })
    );
  } else if (pfadsScore.totalScore >= 151) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'pfads_moderate_risk',
        severity: 'moderate',
        title: 'Moderate PFADS concern',
        description: 'Student recorded a PFADS score within the moderate influence band.',
        metadata: { totalScore: pfadsScore.totalScore },
        io
      })
    );
  }

  if (prediction.probability >= 0.75) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'dropout_high_risk',
        severity: 'high',
        title: 'High dropout probability',
        description: 'Predictive model estimated a high dropout probability for this student.',
        metadata: { probability: prediction.probability },
        io
      })
    );
  }

  return alerts;
}

async function evaluateSentimentAlerts({ studentId, counselorId, sentiment, sourceType, messageText = '', io }) {
  const alerts = [];
  const loweredMessage = String(messageText || '').toLowerCase();
  const explicitCrisis = CRISIS_PATTERNS.some((pattern) => loweredMessage.includes(pattern));

  if (explicitCrisis) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'crisis_language_detected',
        severity: 'high',
        title: 'Urgent crisis language detected',
        description: `A ${sourceType} message included language associated with immediate risk.`,
        metadata: {
          sentiment,
          messageText
        },
        io
      })
    );
  } else if (sentiment.label === 'Negative' && sentiment.stressIndicator >= 0.75) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'severe_distress_sentiment',
        severity: 'high',
        title: 'Severe distress detected',
        description: `A ${sourceType} message showed severe negative sentiment.`,
        metadata: sentiment,
        io
      })
    );
  } else if (sentiment.label === 'Negative') {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'negative_sentiment_pattern',
        severity: sentiment.stressIndicator >= 0.5 ? 'moderate' : 'low',
        title: 'Negative sentiment observed',
        description: `A ${sourceType} message showed negative emotional tone.`,
        metadata: sentiment,
        io
      })
    );
  }

  const repeatedPattern = await countRepeatedNegativePatterns(studentId);
  if (repeatedPattern.negativeCount >= 3 || repeatedPattern.averageStress >= 0.6) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'repeated_negative_pattern',
        severity: repeatedPattern.averageStress >= 0.75 ? 'high' : 'moderate',
        title: 'Repeated negative emotional pattern',
        description: 'Recent chat sentiment indicates recurring psychological distress.',
        metadata: repeatedPattern,
        io
      })
    );
  }

  return alerts;
}

async function evaluateChatEscalationAlert({ studentId, counselorId, chatReply, studentMessage, io }) {
  if (!chatReply?.escalate) {
    return [];
  }

  return [
    await findOrCreateAlert({
      studentId,
      counselorId,
      type: 'ai_chat_escalation',
      severity: chatReply.alertSeverity || 'moderate',
      title: 'AI chat escalation recommended',
      description: chatReply.escalationReason || 'The AI support session recommends counsellor follow-up.',
      metadata: {
        topic: chatReply.topic,
        source: chatReply.source,
        studentMessage
      },
      io
    })
  ];
}

async function evaluateHolisticAlerts({ studentId, counselorId, evaluation, io }) {
  if (!evaluation) {
    return [];
  }

  const alerts = [];

  if (evaluation.overallRiskIndex >= 78) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'holistic_high_risk',
        severity: 'high',
        title: 'Holistic risk evaluation indicates urgent follow-up',
        description: evaluation.summary,
        metadata: {
          overallRiskIndex: evaluation.overallRiskIndex,
          concernDrivers: evaluation.concernDrivers
        },
        io
      })
    );
  } else if (evaluation.overallRiskIndex >= 58) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'holistic_moderate_risk',
        severity: 'moderate',
        title: 'Holistic risk evaluation indicates closer monitoring',
        description: evaluation.summary,
        metadata: {
          overallRiskIndex: evaluation.overallRiskIndex,
          concernDrivers: evaluation.concernDrivers
        },
        io
      })
    );
  }

  if (evaluation.screenRiskIndex >= 68 && evaluation.sleepRiskIndex >= 55) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'screen_sleep_imbalance',
        severity: evaluation.sleepRiskIndex >= 70 ? 'high' : 'moderate',
        title: 'Screen time and sleep imbalance detected',
        description: 'High screen time combined with low sleep may be worsening concentration and emotional strain.',
        metadata: {
          screenTimeMinutes: evaluation.screenTimeMinutes,
          sleepHours: evaluation.sleepHours
        },
        io
      })
    );
  }

  if (evaluation.overdueAssignedCount >= 2 || (evaluation.engagementIndex <= 35 && evaluation.behavioralVarianceIndex >= 45)) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        counselorId,
        type: 'task_engagement_drop',
        severity: evaluation.overdueAssignedCount >= 3 ? 'high' : 'moderate',
        title: 'Task engagement drop detected',
        description: 'Task completion and behavioral consistency suggest the student may need a structured intervention plan.',
        metadata: {
          overdueAssignedCount: evaluation.overdueAssignedCount,
          engagementIndex: evaluation.engagementIndex,
          behavioralVarianceIndex: evaluation.behavioralVarianceIndex
        },
        io
      })
    );
  }

  return alerts;
}

module.exports = {
  findOrCreateAlert,
  evaluateAssessmentAlerts,
  evaluateSentimentAlerts,
  evaluateChatEscalationAlert,
  evaluateHolisticAlerts
};
