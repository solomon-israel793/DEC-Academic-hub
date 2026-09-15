const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['mcq', 'subjective'], required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },

    questionText: { type: String, required: true, trim: true },
    image: { type: String, default: null }, // relative path e.g. /uploads/questions/xyz.jpg

    // --- MCQ fields ---
    options: {
      type: [String],
      validate: {
        validator: function (val) {
          // Only required/validated for mcq type
          if (this.type !== 'mcq') return true;
          return Array.isArray(val) && val.length === 4;
        },
        message: 'Multiple choice questions need exactly 4 options.',
      },
    },
    correctAnswer: { type: String }, // for mcq: must match one of the 4 options exactly

    // --- Subjective fields ---
    expectedAnswer: { type: String }, // the model answer used for grading

    explanation: { type: String, default: '' },
    marks: { type: Number, default: 1 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

questionSchema.index({ course: 1, topic: 1 });

module.exports = mongoose.model('Question', questionSchema);
