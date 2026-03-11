const asyncHandler = require('../utils/asyncHandler');
const Student = require('../models/Student');
const Counselor = require('../models/Counselor');
const Alert = require('../models/Alert');
const PfadsScore = require('../models/PfadsScore');
const PredictionResult = require('../models/PredictionResult');
const { getAdminAnalytics } = require('../services/analyticsService');

const getDashboard = asyncHandler(async (_req, res) => {
  res.json(await getAdminAnalytics());
});

const getStudents = asyncHandler(async (_req, res) => {
  const students = await Student.find().sort({ createdAt: -1 }).lean();
  const scores = await PfadsScore.find().sort({ createdAt: -1 }).lean();
  const predictions = await PredictionResult.find().sort({ createdAt: -1 }).lean();

  const latestScores = new Map();
  const latestPredictions = new Map();

  for (const score of scores) {
    if (!latestScores.has(score.student.toString())) {
      latestScores.set(score.student.toString(), score);
    }
  }

  for (const prediction of predictions) {
    if (!latestPredictions.has(prediction.student.toString())) {
      latestPredictions.set(prediction.student.toString(), prediction);
    }
  }

  res.json({
    students: students.map((student) => ({
      ...student,
      latestScore: latestScores.get(student._id.toString()) || null,
      latestPrediction: latestPredictions.get(student._id.toString()) || null
    }))
  });
});

const getCounselors = asyncHandler(async (_req, res) => {
  const counselors = await Counselor.find().sort({ createdAt: -1 }).lean();
  res.json({ counselors });
});

const getAlerts = asyncHandler(async (_req, res) => {
  const alerts = await Alert.find()
    .populate('student', 'fullName district')
    .populate('counselor', 'name district')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ alerts });
});

const resolveAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findByIdAndUpdate(req.params.id, { resolved: true }, { new: true });
  if (!alert) {
    return res.status(404).json({ message: 'Alert not found' });
  }

  res.json({
    message: 'Alert resolved',
    alert
  });
});

module.exports = {
  getDashboard,
  getStudents,
  getCounselors,
  getAlerts,
  resolveAlert
};
