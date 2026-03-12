const mongoose = require('mongoose');

const deviceSyncSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    source: { type: String, required: true },
    sessionId: { type: String, default: null, index: true },
    screenName: { type: String, default: '' },
    dateKey: { type: String, default: '' },
    steps: { type: Number, default: 0 },
    sleepHours: { type: Number, default: 0 },
    focusMinutes: { type: Number, default: 0 },
    screenTimeMinutes: { type: Number, default: 0 },
    activeMinutes: { type: Number, default: 0 },
    idleMinutes: { type: Number, default: 0 },
    studyScreenMinutes: { type: Number, default: 0 },
    activityScore: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    hookType: { type: String, default: 'manual' },
    sourceMeta: { type: Object, default: {} }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('DeviceSync', deviceSyncSchema, 'device_syncs');
