const asyncHandler = require('../utils/asyncHandler');
const Appointment = require('../models/Appointment');
const Alert = require('../models/Alert');
const Counselor = require('../models/Counselor');
const Student = require('../models/Student');
const PfadsScore = require('../models/PfadsScore');
const ClusterResult = require('../models/ClusterResult');
const PredictionResult = require('../models/PredictionResult');
const SentimentLog = require('../models/SentimentLog');
const DailyCheckin = require('../models/DailyCheckin');
const DeviceSync = require('../models/DeviceSync');
const StudentIntroProfile = require('../models/StudentIntroProfile');
const TaskCompletion = require('../models/TaskCompletion');
const AssignedTask = require('../models/AssignedTask');
const { buildTaskSummary } = require('../services/taskInsightService');
const { buildStudentEvaluation } = require('../services/studentEvaluationService');

const getDashboard = asyncHandler(async (req, res) => {
  const counselor = await Counselor.findById(req.user.userId).lean();
  const [appointments, alerts, assignedTasks] = await Promise.all([
    Appointment.find({ counselor: counselor._id })
      .populate('student', 'fullName district email dominantRisk')
      .sort({ createdAt: -1 })
      .lean(),
    Alert.find({ counselor: counselor._id, resolved: false })
      .populate('student', 'fullName district')
      .sort({ createdAt: -1 })
      .lean(),
    AssignedTask.find({ counselor: counselor._id, status: { $in: ['assigned', 'in_progress', 'overdue'] } })
      .populate('student', 'fullName district')
      .sort({ dueDate: 1, createdAt: -1 })
      .lean()
  ]);

  res.json({
    counselor,
    appointments,
    alerts,
    assignedTasks
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
  const [
    student,
    latestScore,
    latestCluster,
    latestPrediction,
    latestCheckin,
    latestDeviceSync,
    latestIntroProfile,
    sentiments,
    alerts,
    appointments,
    assignedTasks,
    taskCompletions
  ] = await Promise.all([
    Student.findById(studentId).lean(),
    PfadsScore.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    ClusterResult.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    PredictionResult.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    DailyCheckin.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    DeviceSync.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    StudentIntroProfile.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    SentimentLog.find({ student: studentId }).sort({ createdAt: -1 }).limit(10).lean(),
    Alert.find({ student: studentId }).sort({ createdAt: -1 }).lean(),
    Appointment.find({ student: studentId, counselor: req.user.userId }).sort({ createdAt: -1 }).lean(),
    AssignedTask.find({ student: studentId, counselor: req.user.userId }).sort({ createdAt: -1 }).lean(),
    TaskCompletion.find({ student: studentId }).sort({ createdAt: -1 }).limit(200).lean()
  ]);

  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  const taskSummary = buildTaskSummary(taskCompletions, assignedTasks);
  const evaluation = buildStudentEvaluation({
    student,
    latestScore,
    latestPrediction,
    latestCheckin,
    sentiments,
    taskSummary,
    latestDeviceSync,
    latestIntroProfile,
    assignedTasks
  });

  res.json({
    student,
    latestScore,
    latestCluster,
    latestPrediction,
    latestCheckin,
    latestDeviceSync,
    latestIntroProfile,
    sentiments,
    alerts,
    appointments,
    assignedTasks,
    taskSummary,
    evaluation
  });
});

const assignTask = asyncHandler(async (req, res) => {
  const studentId = req.params.studentId;
  const title = String(req.body.title || '').trim();
  if (!title) {
    return res.status(400).json({ message: 'Task title is required' });
  }

  const appointment = await Appointment.findOne({
    student: studentId,
    counselor: req.user.userId,
    status: { $ne: 'cancelled' }
  }).lean();

  if (!appointment) {
    return res.status(403).json({ message: 'This student is not currently assigned to you.' });
  }

  const assignedTask = await AssignedTask.create({
    student: studentId,
    counselor: req.user.userId,
    title,
    description: String(req.body.description || '').trim(),
    category: String(req.body.category || 'Counselor Plan').trim(),
    priority: req.body.priority || 'moderate',
    estimatedMinutes: Number(req.body.estimatedMinutes || 10),
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    metadata: {
      createdFrom: 'counselor_dashboard'
    }
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`user:${studentId}`).emit('tasks:assigned', assignedTask);
  }

  res.status(201).json({
    message: 'Counselor task assigned',
    assignedTask
  });
});

module.exports = {
  getDashboard,
  getAppointments,
  updateAppointment,
  getStudentReport,
  assignTask
};
