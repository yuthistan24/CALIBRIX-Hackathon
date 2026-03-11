const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    counselor: { type: mongoose.Schema.Types.ObjectId, ref: 'Counselor', default: null },
    type: { type: String, required: true },
    severity: { type: String, enum: ['low', 'moderate', 'high'], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    metadata: { type: Object, default: {} }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Alert', alertSchema, 'alerts');
