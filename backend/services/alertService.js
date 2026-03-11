const Alert = require('../models/Alert');
const SentimentLog = require('../models/SentimentLog');

async function findOrCreateAlert({ studentId, counselorId, type, severity, title, description, metadata = {}, io }) {
  const recentDuplicate = await Alert.findOne({
    student: studentId,
    type,
    resolved: false,
    createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 6) }
  });

  if (recentDuplicate) {
    return recentDuplicate;
  }

  const alert = await Alert.create({
    student: studentId,
    counselor: counselorId || null,
    type,
    severity,
    title,
    description,
    metadata
  });

  if (io) {
    io.to('role:admin').emit('alerts:new', alert);
    if (counselorId) {
      io.to(`user:${counselorId}`).emit('alerts:new', alert);
    }
  }

  return alert;
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

async function evaluateSentimentAlerts({ studentId, counselorId, sentiment, sourceType, io }) {
  const alerts = [];

  if (sentiment.label === 'Negative' && sentiment.stressIndicator >= 0.75) {
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
        severity: 'low',
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

module.exports = {
  evaluateAssessmentAlerts,
  evaluateSentimentAlerts
};
