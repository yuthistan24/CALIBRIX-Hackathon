const NEED_MAP = [
  {
    need: 'Academic guidance',
    keywords: ['study', 'exam', 'assignment', 'marks', 'grade', 'deadline', 'focus']
  },
  {
    need: 'Mental health support',
    keywords: ['sad', 'anxious', 'panic', 'depressed', 'stress', 'overwhelmed', 'hopeless']
  },
  {
    need: 'Financial or scholarship support',
    keywords: ['scholarship', 'fees', 'money', 'financial', 'loan', 'support']
  },
  {
    need: 'Social belonging support',
    keywords: ['alone', 'lonely', 'friends', 'isolated', 'belong']
  },
  {
    need: 'Family support',
    keywords: ['family', 'parents', 'home', 'conflict', 'pressure']
  },
  {
    need: 'Career and mentoring support',
    keywords: ['career', 'mentor', 'future', 'job', 'guidance']
  },
  {
    need: 'Language or communication support',
    keywords: ['language', 'english', 'hindi', 'communication', 'speaking']
  }
];

function identifyStudentNeeds(transcript = '') {
  const lowered = transcript.toLowerCase();
  const detectedNeeds = NEED_MAP.filter((entry) =>
    entry.keywords.some((keyword) => lowered.includes(keyword))
  ).map((entry) => entry.need);

  const needs = detectedNeeds.length ? detectedNeeds : ['General orientation support'];
  const urgency =
    lowered.includes('give up') || lowered.includes('hopeless') || lowered.includes('panic')
      ? 'high'
      : lowered.includes('stress') || lowered.includes('worried')
        ? 'moderate'
        : 'low';

  return {
    needs,
    urgency,
    summary: `Detected support themes: ${needs.join(', ')}.`
  };
}

module.exports = {
  identifyStudentNeeds
};
