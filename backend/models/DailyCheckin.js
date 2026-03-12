const mongoose = require('mongoose');

const dailyCheckinSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    dateKey: { type: String, required: true, trim: true },
    responses: {
      mood: { type: String, required: true },
      stress: { type: String, required: true },
      study_motivation: { type: String, required: true },
      sleep_quality: { type: String, required: true },
      energy_level: { type: String, required: true },
      academic_pressure: { type: String, required: true },
      social_interaction: { type: String, required: true },
      anxiety: { type: String, required: true },
      confidence: { type: String, required: true },
      biggest_challenge: { type: String, required: true, trim: true },
      giving_up: { type: String, required: true }
    },
    metrics: {
      riskScore: { type: Number, required: true },
      wellbeingScore: { type: Number, required: true },
      riskLevel: { type: String, required: true },
      flags: { type: [String], default: [] }
    },
    challengeSentiment: {
      score: { type: Number, required: true },
      label: { type: String, required: true },
      stressIndicator: { type: Number, required: true }
    }
  },
  {
    timestamps: true
  }
);

dailyCheckinSchema.index({ student: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('DailyCheckin', dailyCheckinSchema, 'daily_checkins');
