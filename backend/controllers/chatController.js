const asyncHandler = require('../utils/asyncHandler');
const ChatMessage = require('../models/ChatMessage');
const SentimentLog = require('../models/SentimentLog');
const { analyzeSentiment } = require('../services/aiService');
const { evaluateSentimentAlerts } = require('../services/alertService');
const Student = require('../models/Student');

const getRoomMessages = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 100);
  const messages = await ChatMessage.find({ roomId: req.params.roomId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

  res.json({ messages });
});

const postRoomMessage = asyncHandler(async (req, res) => {
  const messageText = String(req.body.message || '').trim();
  if (!messageText) {
    return res.status(400).json({ message: 'Message is required' });
  }

  const senderRole = req.user.role;
  const roomId = req.params.roomId;
  const studentId = senderRole === 'student' ? req.user.userId : req.body.studentId;
  const counselorId = senderRole === 'counselor' ? req.user.userId : req.body.counselorId;

  if (!studentId || !counselorId) {
    return res.status(400).json({ message: 'Student and counselor identifiers are required' });
  }

  const sentiment = await analyzeSentiment(messageText);
  const message = await ChatMessage.create({
    roomId,
    student: studentId,
    counselor: counselorId,
    senderRole,
    senderId: req.user.userId,
    recipientId: req.body.recipientId || null,
    message: messageText,
    sentiment
  });

  if (senderRole === 'student') {
    await SentimentLog.create({
      student: studentId,
      counselor: counselorId,
      sourceType: 'counselor_chat',
      message: messageText,
      sentimentScore: sentiment.score,
      label: sentiment.label,
      stressIndicator: sentiment.stressIndicator
    });

    await Student.updateOne({ _id: studentId }, { latestSentimentScore: sentiment.score });
    await evaluateSentimentAlerts({
      studentId,
      counselorId,
      sentiment,
      sourceType: 'counselor_chat',
      messageText,
      io: req.app.get('io')
    });
  }

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('chat:message', message);
  }

  res.status(201).json({
    message
  });
});

module.exports = {
  getRoomMessages,
  postRoomMessage
};
