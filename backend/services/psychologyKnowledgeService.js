const knowledgeBase = require('../data/psychologicalKnowledgeBase');

function scoreEntry(entry, loweredMessage = '', studentContext = {}) {
  let score = 0;

  for (const keyword of entry.keywords || []) {
    if (loweredMessage.includes(keyword)) {
      score += 3;
    }
  }

  const dominantRisk = String(studentContext.dominantRisk || '').toLowerCase();
  if (dominantRisk && (entry.title || '').toLowerCase().includes(dominantRisk.split(' ')[0])) {
    score += 2;
  }

  if (studentContext.latestCheckinRisk === 'High concern') {
    score += 1;
  }

  return score;
}

function retrieveRelevantGuidance({ message = '', studentContext = {}, maxEntries = 3 }) {
  const loweredMessage = String(message || '').toLowerCase();

  return knowledgeBase
    .map((entry) => ({
      ...entry,
      matchScore: scoreEntry(entry, loweredMessage, studentContext)
    }))
    .filter((entry) => entry.matchScore > 0)
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, maxEntries);
}

function formatGuidanceForPrompt(entries = []) {
  if (!entries.length) {
    return 'No additional psychological guidance snippets were matched.';
  }

  return entries
    .map(
      (entry) =>
        [
          `Topic: ${entry.title}`,
          `Guidance: ${entry.guidance}`,
          `Support steps: ${(entry.supportSteps || []).join('; ')}`,
          `Escalation signals: ${(entry.escalationSignals || []).join('; ')}`
        ].join('\n')
    )
    .join('\n\n');
}

module.exports = {
  retrieveRelevantGuidance,
  formatGuidanceForPrompt
};
