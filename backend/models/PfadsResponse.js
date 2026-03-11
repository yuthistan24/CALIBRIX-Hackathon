const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: Number, required: true },
    section: { type: String, required: true },
    value: { type: Number, required: true, min: 1, max: 5 }
  },
  { _id: false }
);

const pfadsResponseSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    answers: { type: [answerSchema], required: true }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PfadsResponse', pfadsResponseSchema, 'pfads_responses');
