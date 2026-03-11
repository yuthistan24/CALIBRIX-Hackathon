const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    counselor: { type: mongoose.Schema.Types.ObjectId, ref: 'Counselor', required: true },
    specializationNeed: { type: String, required: true },
    district: { type: String, required: true },
    preferredDate: { type: Date, required: true },
    scheduledFor: { type: Date, default: null },
    status: {
      type: String,
      enum: ['requested', 'assigned', 'scheduled', 'completed', 'cancelled'],
      default: 'assigned'
    },
    notes: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Appointment', appointmentSchema, 'appointments');
