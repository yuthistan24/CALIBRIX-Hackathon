const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 10, max: 100 },
    gender: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'student' },
    historicalEngagement: { type: Number, default: 0.6, min: 0, max: 1 },
    assessmentCompletionPatterns: { type: Number, default: 0.8, min: 0, max: 1 },
    dailyResilienceScore: { type: Number, default: 0, min: 0, max: 100 },
    resilienceStreak: { type: Number, default: 0, min: 0 },
    achievementBadges: { type: [String], default: [] },
    lastResilienceActivityAt: { type: Date, default: null },
    dominantRisk: { type: String, default: 'Pending assessment' },
    lastAssessmentAt: { type: Date, default: null },
    latestSentimentScore: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Student', studentSchema, 'students');
