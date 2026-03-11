const mongoose = require('mongoose');

const counselorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    qualification: { type: String, required: true, trim: true },
    specialization: { type: [String], required: true, default: [] },
    experience: { type: Number, required: true, min: 0 },
    hospitalOrClinic: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'counselor' },
    workloadCapacity: { type: Number, default: 8, min: 1 },
    activeSessions: { type: Number, default: 0, min: 0 }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Counselor', counselorSchema, 'counselors');
