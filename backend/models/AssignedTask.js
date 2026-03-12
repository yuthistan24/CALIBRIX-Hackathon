const mongoose = require('mongoose');

const assignedTaskSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    counselor: { type: mongoose.Schema.Types.ObjectId, ref: 'Counselor', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, default: 'Counselor Plan', trim: true },
    priority: {
      type: String,
      enum: ['low', 'moderate', 'high'],
      default: 'moderate'
    },
    estimatedMinutes: { type: Number, default: 10, min: 1 },
    dueDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['assigned', 'in_progress', 'completed', 'overdue', 'cancelled'],
      default: 'assigned'
    },
    completionNotes: { type: String, default: '', trim: true },
    completedAt: { type: Date, default: null },
    metadata: { type: Object, default: {} }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AssignedTask', assignedTaskSchema, 'assigned_tasks');
