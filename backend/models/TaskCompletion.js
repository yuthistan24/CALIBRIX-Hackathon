const mongoose = require('mongoose');

const taskCompletionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    counselor: { type: mongoose.Schema.Types.ObjectId, ref: 'Counselor', default: null },
    assignedTask: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignedTask', default: null },
    taskId: { type: String, required: true },
    taskTitle: { type: String, required: true },
    category: { type: String, required: true },
    sourceType: {
      type: String,
      enum: ['daily', 'assigned', 'mini_game', 'resilience', 'manual'],
      default: 'daily'
    },
    dateKey: { type: String, required: true },
    durationSeconds: { type: Number, required: true, min: 0 },
    varianceFromEstimateSeconds: { type: Number, default: 0 },
    completionNotes: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('TaskCompletion', taskCompletionSchema, 'task_completions');
