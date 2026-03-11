const mongoose = require('mongoose');

const predictionResultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    pfadsScore: { type: mongoose.Schema.Types.ObjectId, ref: 'PfadsScore', required: true },
    probability: { type: Number, required: true, min: 0, max: 1 },
    riskLevel: { type: String, required: true },
    featureSnapshot: { type: Object, default: {} }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PredictionResult', predictionResultSchema, 'prediction_results');
