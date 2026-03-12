const mongoose = require('mongoose');

const sentimentLogSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    counselor: { type: mongoose.Schema.Types.ObjectId, ref: 'Counselor', default: null },
    sourceType: { type: String, enum: ['ai_chat', 'counselor_chat', 'daily_checkin'], required: true },
    message: { type: String, required: true },
    sentimentScore: { type: Number, required: true },
    label: { type: String, required: true },
    stressIndicator: { type: Number, required: true, min: 0, max: 1 }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SentimentLog', sentimentLogSchema, 'sentiment_logs');
