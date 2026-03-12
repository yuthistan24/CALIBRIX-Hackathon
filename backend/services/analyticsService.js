const Student = require('../models/Student');
const Counselor = require('../models/Counselor');
const PfadsScore = require('../models/PfadsScore');
const ClusterResult = require('../models/ClusterResult');
const PredictionResult = require('../models/PredictionResult');
const SentimentLog = require('../models/SentimentLog');
const Alert = require('../models/Alert');

const PFADS_BUCKETS = ['Low psychological influence', 'Mild influence', 'Moderate influence', 'High influence'];
const CLUSTER_BUCKETS = [
  'Emotional distress dominant',
  'Academic helplessness',
  'Family stress dominant',
  'Social belonging issues',
  'Coping resilience deficit'
];
const DROPOUT_BUCKETS = ['Low risk', 'Medium risk', 'High risk'];
const SENTIMENT_BUCKETS = ['Positive', 'Neutral', 'Negative'];

function fillDistribution(entries, buckets) {
  const counts = new Map(entries.map((entry) => [entry._id, entry.count]));
  return buckets.map((bucket) => ({
    _id: bucket,
    count: counts.get(bucket) || 0
  }));
}

async function latestDocumentsByStudent(Model) {
  return Model.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$student',
        document: { $first: '$$ROOT' }
      }
    },
    {
      $replaceRoot: {
        newRoot: '$document'
      }
    }
  ]);
}

async function distributionFromLatest(Model, field, buckets) {
  const latest = await latestDocumentsByStudent(Model);
  const counts = new Map();

  latest.forEach((entry) => {
    const value = entry[field] || 'Unknown';
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return fillDistribution(
    Array.from(counts.entries()).map(([key, count]) => ({
      _id: key,
      count
    })),
    buckets
  );
}

async function districtPatterns() {
  const students = await Student.find().lean();
  const scores = await latestDocumentsByStudent(PfadsScore);

  const latestByStudent = new Map(scores.map((score) => [score.student.toString(), score]));
  const byDistrict = {};

  for (const student of students) {
    const district = student.district || 'Unspecified';
    if (!byDistrict[district]) {
      byDistrict[district] = { district, students: 0, totalScore: 0, alerts: 0 };
    }

    byDistrict[district].students += 1;
    const latestScore = latestByStudent.get(student._id.toString());
    byDistrict[district].totalScore += latestScore ? latestScore.totalScore : 0;
  }

  const alerts = await Alert.find({ resolved: false }).populate('student', 'district').lean();
  for (const alert of alerts) {
    const district = alert.student?.district || 'Unspecified';
    if (!byDistrict[district]) {
      byDistrict[district] = { district, students: 0, totalScore: 0, alerts: 0 };
    }
    byDistrict[district].alerts += 1;
  }

  return Object.values(byDistrict)
    .map((entry) => ({
      district: entry.district,
      averageScore: entry.students ? Number((entry.totalScore / entry.students).toFixed(2)) : 0,
      alerts: entry.alerts
    }))
    .sort((left, right) => right.averageScore - left.averageScore || right.alerts - left.alerts);
}

async function getAdminAnalytics() {
  const [studentCount, counselorCount, unresolvedAlerts, pfadsDistribution, clusterDistribution, dropoutDistribution] =
    await Promise.all([
      Student.countDocuments(),
      Counselor.countDocuments(),
      Alert.countDocuments({ resolved: false }),
      distributionFromLatest(PfadsScore, 'riskLevel', PFADS_BUCKETS),
      distributionFromLatest(ClusterResult, 'clusterLabel', CLUSTER_BUCKETS),
      distributionFromLatest(PredictionResult, 'riskLevel', DROPOUT_BUCKETS)
    ]);

  const sentimentAggregation = await SentimentLog.aggregate([
    {
      $group: {
        _id: '$label',
        averageStress: { $avg: '$stressIndicator' },
        count: { $sum: 1 }
      }
    }
  ]);

  const sentimentTrend = fillDistribution(sentimentAggregation, SENTIMENT_BUCKETS).map((entry) => ({
    ...entry,
    averageStress: sentimentAggregation.find((item) => item._id === entry._id)?.averageStress || 0
  }));

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
