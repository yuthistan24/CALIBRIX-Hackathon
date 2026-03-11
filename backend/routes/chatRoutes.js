const express = require('express');

const { getRoomMessages, postRoomMessage } = require('../controllers/chatController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/rooms/:roomId/messages', protect, authorize('student', 'counselor', 'admin'), getRoomMessages);
router.post('/rooms/:roomId/messages', protect, authorize('student', 'counselor'), postRoomMessage);

module.exports = router;
