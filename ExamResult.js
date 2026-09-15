const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    questionText: String, // snapshot, in case question is edited/deleted later
    userAnswer: String,
    correctAnswer: String,
    isCorrect: Boolean,
    marksAwarded: Number,
    marksPossible: Number,
    feedback: String, // e.g. "Correct", "Partially correct", "Incorrect", "Opposite meaning"
    explanation: String,
  },
  { _id: false }
);

const examResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    mode: { type: String, enum: ['short', 'medium', 'long', 'instant'], required: true },

    answers: [answerSchema],

    totalMarks: Number,
    marksScored: Number,
    percentage: Number,
    totalQuestions: Number,
    correctCount: Number,
    wrongCount: Number,

    startedAt: Date,
    submittedAt: { type: Date, default: Date.now },
    durationSeconds: Number, // how long the user actually took
  },
  { timestamps: true }
);

examResultSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ExamResult', examResultSchema);
