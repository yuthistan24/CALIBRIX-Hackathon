const express = require('express');

const {
  getDashboard,
  getAppointments,
  updateAppointment,
  getStudentReport,
  assignTask
} = require('../controllers/counselorController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', protect, authorize('counselor'), getDashboard);
router.get('/appointments', protect, authorize('counselor'), getAppointments);
router.get('/students/:studentId/report', protect, authorize('counselor'), getStudentReport);
router.post('/students/:studentId/tasks', protect, authorize('counselor'), assignTask);
router.patch('/appointments/:id', protect, authorize('counselor'), updateAppointment);

module.exports = router;
