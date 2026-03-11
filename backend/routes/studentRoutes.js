const express = require('express');

const {
  getQuestions,
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
router.get('/dashboard', protect, authorize('student'), getDashboard);
router.get('/resources', protect, authorize('student'), getResources);
router.get('/emotion-timeline', protect, authorize('student'), getEmotionTimeline);
router.post('/assessment', protect, authorize('student'), submitAssessment);
router.post('/appointments', protect, authorize('student'), requestAppointment);
router.post('/ai-chat', protect, authorize('student'), postAiChat);
router.post('/resilience', protect, authorize('student'), updateResilienceProgress);

module.exports = router;
