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

function buildTaskSummary(completions, assignedTasks = []) {
  const streak = calculateTaskStreak(completions);
  const variance = calculateCompletionVariance(completions);
  const todayKey = getDateKey();
  const completionMap = new Map();
  const assignedCompletionMap = new Map();

  for (const completion of completions) {
    if (completion.sourceType === 'assigned' && completion.assignedTask) {
      const assignedTaskId = completion.assignedTask.toString();
      if (!assignedCompletionMap.has(assignedTaskId)) {
        assignedCompletionMap.set(assignedTaskId, []);
      }
      assignedCompletionMap.get(assignedTaskId).push(completion);
      continue;
    }

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
  const now = Date.now();
  const enrichedAssignedTasks = assignedTasks
    .map((task) => {
      const completionEntries = assignedCompletionMap.get(task._id.toString()) || [];
      const completed = task.status === 'completed';
      const overdue = !completed && task.status !== 'cancelled' && task.dueDate && new Date(task.dueDate).getTime() < now;
      const latestCompletion = completionEntries[0] || null;
      const averageDurationSeconds = completionEntries.length
        ? Math.round(
            completionEntries.reduce((sum, entry) => sum + Number(entry.durationSeconds || 0), 0) / completionEntries.length
          )
        : Number(task.estimatedMinutes || 0) * 60;

      return {
        ...task,
        status: overdue ? 'overdue' : task.status,
        overdue,
        completedToday: completionEntries.some((entry) => entry.dateKey === todayKey) || Boolean(completed && task.completedAt && getDateKey(new Date(task.completedAt)) === todayKey),
        completionCount: completionEntries.length,
        latestCompletionAt: latestCompletion?.createdAt || task.completedAt || null,
        averageDurationSeconds
      };
    })
    .sort((left, right) => {
      const leftWeight = left.status === 'overdue' ? 0 : left.status === 'assigned' ? 1 : left.status === 'in_progress' ? 2 : 3;
      const rightWeight = right.status === 'overdue' ? 0 : right.status === 'assigned' ? 1 : right.status === 'in_progress' ? 2 : 3;
      return leftWeight - rightWeight || new Date(left.dueDate || left.createdAt).getTime() - new Date(right.dueDate || right.createdAt).getTime();
    });

  const assignedCompletedCount = enrichedAssignedTasks.filter((task) => task.status === 'completed').length;
  const assignedPendingCount = enrichedAssignedTasks.filter((task) =>
    ['assigned', 'in_progress', 'overdue'].includes(task.status)
  ).length;
  const overdueAssignedCount = enrichedAssignedTasks.filter((task) => task.overdue).length;

  return {
    tasks: enrichedTasks,
    streak,
    averageSeconds: variance.averageSeconds,
    completionVarianceSeconds: variance.varianceSeconds,
    completedCount: completions.length,
    completedTodayCount,
    completionRate,
    assignedTasks: enrichedAssignedTasks,
    assignedCompletedCount,
    assignedPendingCount,
    overdueAssignedCount,
    totalAssignedCount: enrichedAssignedTasks.length
  };
}

module.exports = {
  getDateKey,
  buildTaskSummary
};
