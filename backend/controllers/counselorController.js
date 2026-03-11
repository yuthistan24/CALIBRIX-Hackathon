const asyncHandler = require('../utils/asyncHandler');
const Appointment = require('../models/Appointment');
const Alert = require('../models/Alert');
const Counselor = require('../models/Counselor');
const Student = require('../models/Student');
const PfadsScore = require('../models/PfadsScore');
const ClusterResult = require('../models/ClusterResult');
const PredictionResult = require('../models/PredictionResult');
const SentimentLog = require('../models/SentimentLog');

const getDashboard = asyncHandler(async (req, res) => {
  const counselor = await Counselor.findById(req.user.userId).lean();
  const [appointments, alerts] = await Promise.all([
    Appointment.find({ counselor: counselor._id })
      .populate('student', 'fullName district email dominantRisk')
      .sort({ createdAt: -1 })
      .lean(),
    Alert.find({ counselor: counselor._id, resolved: false })
      .populate('student', 'fullName district')
      .sort({ createdAt: -1 })
      .lean()
  ]);

  res.json({
    counselor,
    appointments,
    alerts
  });
});

const getAppointments = asyncHandler(async (req, res) => {
  const appointments = await Appointment.find({ counselor: req.user.userId })
    .populate('student', 'fullName district email dominantRisk')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ appointments });
});

const updateAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({
    _id: req.params.id,
    counselor: req.user.userId
  });

  if (!appointment) {
    return res.status(404).json({ message: 'Appointment not found' });
  }

  const previousStatus = appointment.status;
  appointment.status = req.body.status || appointment.status;
  appointment.notes = req.body.notes ?? appointment.notes;
  appointment.scheduledFor = req.body.scheduledFor ? new Date(req.body.scheduledFor) : appointment.scheduledFor;
  await appointment.save();

  if (
    !['completed', 'cancelled'].includes(previousStatus) &&
    ['completed', 'cancelled'].includes(appointment.status)
  ) {
    await Counselor.updateOne(
      { _id: req.user.userId, activeSessions: { $gt: 0 } },
      { $inc: { activeSessions: -1 } }
    );
  }

  res.json({
    message: 'Appointment updated successfully',
    appointment
  });
});

const getStudentReport = asyncHandler(async (req, res) => {
  const studentId = req.params.studentId;
  const [student, latestScore, latestCluster, latestPrediction, sentiments, alerts, appointments] = await Promise.all([
    Student.findById(studentId).lean(),
    PfadsScore.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    ClusterResult.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    PredictionResult.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    SentimentLog.find({ student: studentId }).sort({ createdAt: -1 }).limit(10).lean(),
    Alert.find({ student: studentId }).sort({ createdAt: -1 }).lean(),
    Appointment.find({ student: studentId, counselor: req.user.userId }).sort({ createdAt: -1 }).lean()
  ]);

  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  res.json({
    student,
    latestScore,
    latestCluster,
    latestPrediction,
    sentiments,
    alerts,
    appointments
  });
});

module.exports = {
  getDashboard,
  getAppointments,
  updateAppointment,
  getStudentReport
};
