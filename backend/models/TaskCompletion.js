const mongoose = require('mongoose');

const taskCompletionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    taskId: { type: String, required: true },
    taskTitle: { type: String, required: true },
    category: { type: String, required: true },
    dateKey: { type: String, required: true },
    durationSeconds: { type: Number, required: true, min: 0 }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('TaskCompletion', taskCompletionSchema, 'task_completions');
