const express = require('express');

const { registerStudent, loginStudent, registerCounselor, loginCounselor, loginAdmin, me } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/students/register', registerStudent);
router.post('/students/login', loginStudent);
router.post('/counselors/register', registerCounselor);
router.post('/counselors/login', loginCounselor);
router.post('/admin/login', loginAdmin);
router.get('/me', protect, me);

module.exports = router;
