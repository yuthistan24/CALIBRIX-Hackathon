const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    counselor: { type: mongoose.Schema.Types.ObjectId, ref: 'Counselor', default: null },
    senderRole: { type: String, required: true },
    senderId: { type: String, required: true },
    recipientId: { type: String, default: null },
    message: { type: String, required: true },
    sentiment: {
      score: { type: Number, default: null },
      label: { type: String, default: null },
      stressIndicator: { type: Number, default: null }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ChatMessage', chatMessageSchema, 'chat_messages');
