const mongoose = require('mongoose');

const deviceSyncSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    source: { type: String, required: true },
    steps: { type: Number, default: 0 },
    sleepHours: { type: Number, default: 0 },
    focusMinutes: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    hookType: { type: String, default: 'manual' }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('DeviceSync', deviceSyncSchema, 'device_syncs');
