const mongoose = require('mongoose');

const pfadsScoreSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    response: { type: mongoose.Schema.Types.ObjectId, ref: 'PfadsResponse', required: true },
    totalScore: { type: Number, required: true, min: 50, max: 250 },
    sectionScores: {
      A: { type: Number, required: true },
      B: { type: Number, required: true },
      C: { type: Number, required: true },
      D: { type: Number, required: true },
      E: { type: Number, required: true }
    },
    riskLevel: { type: String, required: true }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PfadsScore', pfadsScoreSchema, 'pfads_scores');
