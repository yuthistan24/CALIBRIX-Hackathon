const dailyTasks = require('../data/dailyTasks');

function getDateKey(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function calculateTaskStreak(completions) {
  const uniqueDays = [...new Set(completions.map((entry) => entry.dateKey))].sort().reverse();
  if (!uniqueDays.length) {
    return 0;
  }

  let streak = 0;
  let currentDate = new Date(`${getDateKey()}T00:00:00`);

  for (const dateKey of uniqueDays) {
    const expected = getDateKey(currentDate);
    if (dateKey !== expected) {
      break;
    }
    streak += 1;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}

function calculateCompletionVariance(completions) {
  const durations = completions.map((entry) => Number(entry.durationSeconds || 0)).filter(Boolean);
  if (!durations.length) {
    return {
      averageSeconds: 0,
      varianceSeconds: 0
    };
  }

  const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const variance =
    durations.reduce((sum, value) => sum + (value - average) ** 2, 0) / durations.length;

  return {
    averageSeconds: Math.round(average),
    varianceSeconds: Math.round(Math.sqrt(variance))
  };
}

function buildTaskSummary(completions) {
  const streak = calculateTaskStreak(completions);
  const variance = calculateCompletionVariance(completions);
  const todayKey = getDateKey();
  const completionMap = new Map();

  for (const completion of completions) {
    if (!completionMap.has(completion.taskId)) {
      completionMap.set(completion.taskId, []);
    }
    completionMap.get(completion.taskId).push(completion);
  }

  const enrichedTasks = dailyTasks.map((task) => {
    const taskCompletions = completionMap.get(task.id) || [];
    const completedToday = taskCompletions.some((entry) => entry.dateKey === todayKey);
    const latestCompletion = taskCompletions[0] || null;
    const averageDurationSeconds = taskCompletions.length
      ? Math.round(
          taskCompletions.reduce((sum, entry) => sum + Number(entry.durationSeconds || 0), 0) / taskCompletions.length
        )
      : task.estimatedMinutes * 60;

    return {
      ...task,
      completedToday,
      completedCount: taskCompletions.length,
      latestCompletionAt: latestCompletion?.createdAt || null,
      latestDurationSeconds: latestCompletion?.durationSeconds || 0,
      averageDurationSeconds
    };
  });

  const completedTodayCount = enrichedTasks.filter((task) => task.completedToday).length;
  const completionRate = dailyTasks.length ? Math.round((completedTodayCount / dailyTasks.length) * 100) : 0;

  return {
    tasks: enrichedTasks,
    streak,
    averageSeconds: variance.averageSeconds,
    completionVarianceSeconds: variance.varianceSeconds,
    completedCount: completions.length,
    completedTodayCount,
    completionRate
  };
}

module.exports = {
  getDateKey,
  buildTaskSummary
};
