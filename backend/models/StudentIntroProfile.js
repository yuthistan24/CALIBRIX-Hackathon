const mongoose = require('mongoose');

const studentIntroProfileSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    transcript: { type: String, required: true },
    durationSeconds: { type: Number, required: true, min: 0, max: 180 },
    needs: { type: [String], default: [] },
    summary: { type: String, required: true },
    urgency: { type: String, enum: ['low', 'moderate', 'high'], default: 'low' }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StudentIntroProfile', studentIntroProfileSchema, 'student_intro_profiles');
