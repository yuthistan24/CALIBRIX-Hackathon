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
    questionnaireId: { type: String, default: 'pfads-full', index: true },
    questionnaireTitle: { type: String, default: 'Full PFADS Assessment' },
    questionnaireType: { type: String, default: 'pfads_full' },
    answers: { type: [answerSchema], required: true },
    summary: { type: Object, default: {} }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PfadsResponse', pfadsResponseSchema, 'pfads_responses');
