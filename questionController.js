const asyncHandler = require('express-async-handler');
const Question = require('./Question');

function validateQuestionPayload(q) {
  if (!q.type || !['mcq', 'subjective'].includes(q.type)) return 'type must be "mcq" or "subjective".';
  if (!q.questionText) return 'questionText is required.';
  if (!q.course || !q.topic) return 'course and topic are required.';

  if (q.type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length !== 4) return 'mcq questions need exactly 4 options.';
    if (!q.correctAnswer || !q.options.includes(q.correctAnswer)) {
      return 'correctAnswer must exactly match one of the 4 options.';
    }
  } else {
    if (!q.expectedAnswer) return 'expectedAnswer is required for subjective questions.';
  }
  return null;
}

// @desc  Add a single question (form-friendly: one question at a time)
// @route POST /api/questions
// @access Private (admin, staff, masterAdmin)
const createQuestion = asyncHandler(async (req, res) => {
  const payload = { ...req.body, createdBy: req.user._id };

  // Multipart forms (file upload) send "options" as a JSON string, not a real array
  if (typeof payload.options === 'string') {
    try { payload.options = JSON.parse(payload.options); } catch (e) { /* leave as-is, will fail validation */ }
  }

  // If an image file was uploaded alongside the form
  if (req.file) {
    payload.image = `/uploads/questions/${req.file.filename}`;
  }

  const error = validateQuestionPayload(payload);
  if (error) {
    res.status(400);
    throw new Error(error);
  }

  const question = await Question.create(payload);
  res.status(201).json({ success: true, question });
});

// @desc  Bulk add questions in one go - paste a JSON array
// @route POST /api/questions/bulk
// @access Private (admin, staff, masterAdmin)
// Body: { "questions": [ {type, course, topic, questionText, options, correctAnswer, explanation, marks}, ... ] }
const bulkCreateQuestions = asyncHandler(async (req, res) => {
  const { questions } = req.body;

  if (!Array.isArray(questions) || questions.length === 0) {
    res.status(400);
    throw new Error('Provide a non-empty "questions" array.');
  }

  const errors = [];
  const validRows = [];

  questions.forEach((q, i) => {
    const err = validateQuestionPayload(q);
    if (err) {
      errors.push({ row: i + 1, error: err });
    } else {
      validRows.push({ ...q, createdBy: req.user._id });
    }
  });

  const created = validRows.length ? await Question.insertMany(validRows) : [];

  res.status(207).json({
    success: true,
    createdCount: created.length,
    failedCount: errors.length,
    errors,
    questions: created,
  });
});

// @desc  List questions (filter by course/topic), answers hidden by default
// @route GET /api/questions?course=&topic=&includeAnswers=true
// @access Private (any logged-in user; students never get includeAnswers)
const getQuestions = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.course) filter.course = req.query.course;
  if (req.query.topic) filter.topic = req.query.topic;

  let query = Question.find(filter).populate('course', 'name').populate('topic', 'name');

  const isStaffOrAbove = ['admin', 'masterAdmin', 'staff'].includes(req.user.role);
  if (!isStaffOrAbove || req.query.includeAnswers !== 'true') {
    query = query.select('-correctAnswer -expectedAnswer'); // hide answers from students / practice listings
  }

  const questions = await query.sort({ createdAt: -1 });
  res.json({ success: true, count: questions.length, questions });
});

// @route PUT /api/questions/:id
const updateQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id);
  if (!question) {
    res.status(404);
    throw new Error('Question not found.');
  }

  const updates = { ...req.body };
  if (typeof updates.options === 'string') {
    try { updates.options = JSON.parse(updates.options); } catch (e) { /* leave as-is */ }
  }
  Object.assign(question, updates);
  if (req.file) {
    question.image = `/uploads/questions/${req.file.filename}`;
  }

  const error = validateQuestionPayload(question.toObject());
  if (error) {
    res.status(400);
    throw new Error(error);
  }

  await question.save();
  res.json({ success: true, question });
});

// @route DELETE /api/questions/:id
const deleteQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id);
  if (!question) {
    res.status(404);
    throw new Error('Question not found.');
  }
  await question.deleteOne();
  res.json({ success: true, message: 'Question deleted.' });
});

module.exports = {
  createQuestion,
  bulkCreateQuestions,
  getQuestions,
  updateQuestion,
  deleteQuestion,
};
