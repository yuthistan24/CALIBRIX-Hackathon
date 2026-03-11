const Student = require('../models/Student');
const Counselor = require('../models/Counselor');
const PfadsScore = require('../models/PfadsScore');
const ClusterResult = require('../models/ClusterResult');
const PredictionResult = require('../models/PredictionResult');
const SentimentLog = require('../models/SentimentLog');
const Alert = require('../models/Alert');

async function distribution(model, field) {
  return model.aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
}

async function districtPatterns() {
  const students = await Student.find().lean();
  const scores = await PfadsScore.find().sort({ createdAt: -1 }).lean();

  const latestByStudent = new Map();
  for (const score of scores) {
    if (!latestByStudent.has(score.student.toString())) {
      latestByStudent.set(score.student.toString(), score);
    }
  }

  const byDistrict = {};
  for (const student of students) {
    const district = student.district;
    if (!byDistrict[district]) {
      byDistrict[district] = { district, students: 0, totalScore: 0, alerts: 0 };
    }

    byDistrict[district].students += 1;
    const latestScore = latestByStudent.get(student._id.toString());
    byDistrict[district].totalScore += latestScore ? latestScore.totalScore : 0;
  }

  const alerts = await Alert.find({ resolved: false }).populate('student', 'district').lean();
  for (const alert of alerts) {
    const district = alert.student?.district;
    if (!district || !byDistrict[district]) {
      continue;
    }
    byDistrict[district].alerts += 1;
  }

  return Object.values(byDistrict).map((entry) => ({
    district: entry.district,
    averageScore: entry.students ? Number((entry.totalScore / entry.students).toFixed(2)) : 0,
    alerts: entry.alerts
  }));
}

async function getAdminAnalytics() {
  const [studentCount, counselorCount, unresolvedAlerts, pfadsDistribution, clusterDistribution, dropoutDistribution] =
    await Promise.all([
      Student.countDocuments(),
      Counselor.countDocuments(),
      Alert.countDocuments({ resolved: false }),
      distribution(PfadsScore, 'riskLevel'),
      distribution(ClusterResult, 'clusterLabel'),
      distribution(PredictionResult, 'riskLevel')
    ]);

  const sentimentTrend = await SentimentLog.aggregate([
    {
      $group: {
        _id: '$label',
        averageStress: { $avg: '$stressIndicator' },
        count: { $sum: 1 }
      }
    }
  ]);

  const pfadsRadar = await PfadsScore.aggregate([
    {
      $group: {
        _id: null,
        A: { $avg: '$sectionScores.A' },
        B: { $avg: '$sectionScores.B' },
        C: { $avg: '$sectionScores.C' },
        D: { $avg: '$sectionScores.D' },
        E: { $avg: '$sectionScores.E' }
      }
    }
  ]);

  return {
    overview: {
      studentCount,
      counselorCount,
      unresolvedAlerts
    },
    pfadsDistribution,
    clusterDistribution,
    dropoutDistribution,
    sentimentTrend,
    radarAverages: pfadsRadar[0] || { A: 0, B: 0, C: 0, D: 0, E: 0 },
    districtPatterns: await districtPatterns()
  };
}

module.exports = {
  getAdminAnalytics
};
