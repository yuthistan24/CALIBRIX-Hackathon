const express = require('express');

const { getDashboard, getStudents, getCounselors, getAlerts, resolveAlert } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', protect, authorize('admin'), getDashboard);
router.get('/students', protect, authorize('admin'), getStudents);
router.get('/counselors', protect, authorize('admin'), getCounselors);
router.get('/alerts', protect, authorize('admin'), getAlerts);
router.patch('/alerts/:id/resolve', protect, authorize('admin'), resolveAlert);

module.exports = router;
