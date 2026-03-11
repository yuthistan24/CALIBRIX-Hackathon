const Counselor = require('../models/Counselor');

function normalizeSpecialization(value = '') {
  return value.toLowerCase();
}

async function assignCounselor({ specializationNeed, district }) {
  const counselors = await Counselor.find().lean();
  if (!counselors.length) {
    throw new Error('No counselors available');
  }

  const requiredSkill = normalizeSpecialization(specializationNeed);
  const ranked = counselors
    .map((counselor) => {
      const skillMatch = counselor.specialization.some((entry) =>
        normalizeSpecialization(entry).includes(requiredSkill)
      )
        ? 1
        : 0;
      const districtMatch = counselor.district.toLowerCase() === district.toLowerCase() ? 1 : 0;
      const workloadRatio = counselor.activeSessions / counselor.workloadCapacity;

      return {
        counselor,
        score: skillMatch * 5 + districtMatch * 2 - workloadRatio * 4
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.counselor.activeSessions - right.counselor.activeSessions;
    });

  return ranked[0].counselor;
}

module.exports = {
  assignCounselor
};
