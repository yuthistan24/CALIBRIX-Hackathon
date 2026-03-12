function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function average(values = []) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function normalizePercentage(value, max) {
  if (!max) {
    return 0;
  }
  return clamp(Math.round((Number(value || 0) / max) * 100), 0, 100);
}

function buildStudentEvaluation({
  student = {},
  latestScore,
  latestPrediction,
  latestCheckin,
  sentiments = [],
  taskSummary = {},
  latestDeviceSync,
  latestIntroProfile,
  assignedTasks = []
}) {
  const averageSentiment = average(sentiments.map((entry) => entry.sentimentScore));
  const averageStress = average(sentiments.map((entry) => entry.stressIndicator));
  const screenTimeMinutes = Number(latestDeviceSync?.screenTimeMinutes || 0);
  const activeMinutes = Number(latestDeviceSync?.activeMinutes || 0);
  const focusMinutes = Number(latestDeviceSync?.focusMinutes || 0);
  const studyScreenMinutes = Number(latestDeviceSync?.studyScreenMinutes || 0);
  const sleepHours = Number(latestDeviceSync?.sleepHours || 0);
  const overdueAssignedCount = Number(taskSummary.overdueAssignedCount || 0);
  const assignedPendingCount = Number(taskSummary.assignedPendingCount || 0);

  const pfadsIndex = latestScore ? normalizePercentage(latestScore.totalScore, 250) : 0;
  const dropoutIndex = latestPrediction ? clamp(Math.round(latestPrediction.probability * 100), 0, 100) : 0;
  const checkinIndex =
    latestCheckin?.metrics?.riskLevel === 'High concern'
      ? 88
      : latestCheckin?.metrics?.riskLevel === 'Moderate concern'
        ? 58
        : latestCheckin?.metrics
          ? Math.max(0, 100 - latestCheckin.metrics.wellbeingScore)
          : 0;
  const sentimentIndex = clamp(Math.round(((averageStress + Math.max(0, -averageSentiment)) / 2) * 100), 0, 100);
  const engagementPenalty = clamp(
    Math.round(
      100 -
        (Number(taskSummary.completionRate || 0) * 0.55 +
          clamp((focusMinutes / 120) * 100, 0, 100) * 0.25 +
          clamp(student.historicalEngagement * 100, 0, 100) * 0.2)
    ),
    0,
    100
  );
  const varianceIndex = clamp(Math.round((Number(taskSummary.completionVarianceSeconds || 0) / 1800) * 100), 0, 100);
  const screenRiskIndex = clamp(
    Math.round(Math.max(0, screenTimeMinutes - 180) / 4 + Math.max(0, screenTimeMinutes - Math.max(activeMinutes, 1)) / 3),
    0,
    100
  );
  const sleepRiskIndex = sleepHours > 0 ? clamp(Math.round(Math.max(0, 8 - sleepHours) * 18), 0, 100) : 0;
  const introUrgencyIndex =
    latestIntroProfile?.urgency === 'high' ? 85 : latestIntroProfile?.urgency === 'moderate' ? 55 : 0;

  const activeIndices = [
    pfadsIndex,
    dropoutIndex,
    checkinIndex,
    sentimentIndex,
    engagementPenalty,
    varianceIndex,
    screenRiskIndex,
    sleepRiskIndex,
    introUrgencyIndex
  ].filter((value) => value > 0);

  const overallRiskIndex = clamp(Math.round(average(activeIndices)), 0, 100);
  const engagementIndex = clamp(
    Math.round(
      Number(taskSummary.completionRate || 0) * 0.45 +
        clamp((focusMinutes / 120) * 100, 0, 100) * 0.2 +
        clamp((studyScreenMinutes / 90) * 100, 0, 100) * 0.15 +
        clamp(student.historicalEngagement * 100, 0, 100) * 0.2
    ),
    0,
    100
  );
  const stabilityIndex = clamp(Math.round(100 - average([sentimentIndex, varianceIndex, sleepRiskIndex, screenRiskIndex])), 0, 100);

  const concernDrivers = [];
  if (latestCheckin?.metrics?.riskLevel === 'High concern') {
    concernDrivers.push('Daily check-in shows high concern');
  }
  if (dropoutIndex >= 70) {
    concernDrivers.push('Dropout probability is elevated');
  }
  if (screenRiskIndex >= 65) {
    concernDrivers.push('Screen time is high relative to active study time');
  }
  if (sleepRiskIndex >= 55) {
    concernDrivers.push('Recent sleep duration is low');
  }
  if (overdueAssignedCount > 0) {
    concernDrivers.push(`${overdueAssignedCount} counselor task(s) are overdue`);
  }
  if (averageStress >= 0.6) {
    concernDrivers.push('Repeated distress signals are present in recent sentiment');
  }
  if (!concernDrivers.length && !latestScore) {
    concernDrivers.push('PFADS assessment is still pending');
  }

  const protectiveFactors = [];
  if (Number(taskSummary.streak || 0) >= 3) {
    protectiveFactors.push(`Maintained a ${taskSummary.streak}-day task streak`);
  }
  if (engagementIndex >= 60) {
    protectiveFactors.push('Engagement indicators are trending upward');
  }
  if (sleepHours >= 7) {
    protectiveFactors.push('Sleep duration is within a more stable range');
  }
  if (focusMinutes >= 45) {
    protectiveFactors.push('Focused study time is present');
  }
  if (averageSentiment >= 0.15) {
    protectiveFactors.push('Recent tone includes some positive recovery signals');
  }

  const recommendations = [];
  if (screenRiskIndex >= 65) {
    recommendations.push('Reduce non-study screen use and add one phone-free study block.');
  }
  if (sleepRiskIndex >= 55) {
    recommendations.push('Protect a sleep recovery window tonight before adding more workload.');
  }
  if (assignedPendingCount > 0) {
    recommendations.push('Prioritize one counselor-assigned task before starting optional work.');
  }
  if (engagementPenalty >= 60) {
    recommendations.push('Use a single short study sprint instead of a full workload target.');
  }
  if (latestIntroProfile?.needs?.length) {
    recommendations.push(`Support themes from self-introduction: ${latestIntroProfile.needs.join(', ')}.`);
  }
  if (!recommendations.length) {
    recommendations.push('Keep the next step small, visible, and realistic for today.');
  }

  const status =
    overallRiskIndex >= 75 ? 'High concern' : overallRiskIndex >= 50 ? 'Moderate concern' : 'Stable';

  return {
    status,
    overallRiskIndex,
    engagementIndex,
    stabilityIndex,
    behavioralVarianceIndex: varianceIndex,
    pfadsIndex,
    dropoutIndex,
    sentimentIndex,
    screenRiskIndex,
    sleepRiskIndex,
    screenTimeMinutes,
    activeMinutes,
    focusMinutes,
    sleepHours,
    overdueAssignedCount,
    concernDrivers,
    protectiveFactors,
    recommendations,
    summary:
      status === 'High concern'
        ? 'Multiple academic and wellbeing signals suggest urgent follow-up is needed.'
        : status === 'Moderate concern'
          ? 'The student shows mixed risk signals and needs structured follow-up.'
          : 'Current indicators are relatively stable, though continued monitoring is still useful.'
  };
}

module.exports = {
  buildStudentEvaluation
};
