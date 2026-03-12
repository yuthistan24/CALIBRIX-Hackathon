const express = require('express');

const {
  getQuestions,
  getDailyCheckinQuestions,
  getTodayDailyCheckin,
  submitDailyCheckin,
  completeDailyTask,
  syncDeviceMetrics,
  analyzeSelfIntroduction,
  transcribeVoiceMessage,
  submitAssessment,
  getDashboard,
  requestAppointment,
  getResources,
  postAiChat,
  updateResilienceProgress,
  getEmotionTimeline
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/questions', getQuestions);
router.get('/daily-checkin/questions', protect, authorize('student'), getDailyCheckinQuestions);
router.get('/daily-checkin', protect, authorize('student'), getTodayDailyCheckin);
router.get('/dashboard', protect, authorize('student'), getDashboard);
router.get('/resources', protect, authorize('student'), getResources);
router.get('/emotion-timeline', protect, authorize('student'), getEmotionTimeline);
router.post('/daily-checkin', protect, authorize('student'), submitDailyCheckin);
router.post('/daily-tasks/:taskId/complete', protect, authorize('student'), completeDailyTask);
router.post('/device-sync', protect, authorize('student'), syncDeviceMetrics);
router.post('/self-introduction/analyze', protect, authorize('student'), analyzeSelfIntroduction);
router.post('/voice/transcribe', protect, authorize('student'), transcribeVoiceMessage);
router.post('/assessment', protect, authorize('student'), submitAssessment);
router.post('/appointments', protect, authorize('student'), requestAppointment);
router.post('/ai-chat', protect, authorize('student'), postAiChat);
router.post('/resilience', protect, authorize('student'), updateResilienceProgress);

module.exports = router;
