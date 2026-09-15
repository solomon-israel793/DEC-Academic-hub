const asyncHandler = require('express-async-handler');
const Question = require('./Question');
const ExamResult = require('./ExamResult');
const EXAM_MODES = require('./examModes');
const { gradeAnswer } = require('./scoring');

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// @desc  Start an exam: pick Course -> Topic -> Mode, get a question set + timer config
// @route GET /api/exams/start?course=&topic=&mode=short|medium|long|instant
// @access Private (student, or anyone practicing)
const startExam = asyncHandler(async (req, res) => {
  const { course, topic, mode } = req.query;

  if (!course || !topic || !mode || !EXAM_MODES[mode]) {
    res.status(400);
    throw new Error('course, topic and a valid mode (short/medium/long/instant) are required.');
  }

  const config = EXAM_MODES[mode];

  const pool = await Question.find({ course, topic, isActive: true })
    .select('-correctAnswer -expectedAnswer'); // never send answers to the client

  if (pool.length === 0) {
    res.status(404);
    throw new Error('No questions found for this course/topic yet.');
  }

  const selected = shuffle(pool).slice(0, config.questionCount);

  res.json({
    success: true,
    mode,
    modeLabel: config.label,
    durationMinutes: config.durationMinutes,
    instant: config.instant,
    questionCount: selected.length,
    startedAt: new Date(),
    questions: selected,
  });
});

// @desc  Instant Mode helper: grade ONE question immediately and reveal the answer
// @route POST /api/exams/instant/check
// @access Private
// Body: { questionId, userAnswer }
const instantCheck = asyncHandler(async (req, res) => {
  const { questionId, userAnswer } = req.body;
  const question = await Question.findById(questionId);

  if (!question) {
    res.status(404);
    throw new Error('Question not found.');
  }

  const result = gradeAnswer(question, userAnswer);

  res.json({
    success: true,
    ...result,
    correctAnswer: question.type === 'mcq' ? question.correctAnswer : question.expectedAnswer,
    explanation: question.explanation,
  });
});

// @desc  Submit a completed exam (any mode) - grades everything and saves to history
// @route POST /api/exams/submit
// @access Private
// Body: { course, topic, mode, startedAt, answers: [{ questionId, userAnswer }] }
const submitExam = asyncHandler(async (req, res) => {
  const { course, topic, mode, startedAt, answers } = req.body;

  if (!course || !topic || !mode || !Array.isArray(answers) || answers.length === 0) {
    res.status(400);
    throw new Error('course, topic, mode and a non-empty answers array are required.');
  }

  const questionIds = answers.map((a) => a.questionId);
  const questions = await Question.find({ _id: { $in: questionIds } });
  const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

  const gradedAnswers = [];
  let totalMarks = 0;
  let marksScored = 0;
  let correctCount = 0;
  let wrongCount = 0;

  for (const a of answers) {
    const question = questionMap.get(a.questionId);
    if (!question) continue;

    const result = gradeAnswer(question, a.userAnswer);
    totalMarks += result.marksPossible;
    marksScored += result.marksAwarded;
    if (result.isCorrect) correctCount++; else wrongCount++;

    gradedAnswers.push({
      question: question._id,
      questionText: question.questionText,
      userAnswer: a.userAnswer,
      correctAnswer: question.type === 'mcq' ? question.correctAnswer : question.expectedAnswer,
      isCorrect: result.isCorrect,
      marksAwarded: result.marksAwarded,
      marksPossible: result.marksPossible,
      feedback: result.feedback,
      explanation: question.explanation,
    });
  }

  const percentage = totalMarks > 0 ? Math.round((marksScored / totalMarks) * 10000) / 100 : 0;
  const submittedAt = new Date();

  const examResult = await ExamResult.create({
    user: req.user._id,
    course,
    topic,
    mode,
    answers: gradedAnswers,
    totalMarks,
    marksScored,
    percentage,
    totalQuestions: gradedAnswers.length,
    correctCount,
    wrongCount,
    startedAt: startedAt || submittedAt,
    submittedAt,
    durationSeconds: startedAt ? Math.round((submittedAt - new Date(startedAt)) / 1000) : undefined,
  });

  res.status(201).json({ success: true, result: examResult });
});

// @desc  Get the logged-in user's exam history
// @route GET /api/exams/history
// @access Private
const getHistory = asyncHandler(async (req, res) => {
  const results = await ExamResult.find({ user: req.user._id })
    .populate('course', 'name')
    .populate('topic', 'name')
    .sort({ createdAt: -1 })
    .select('-answers'); // summary list only; full detail via /results/:id

  res.json({ success: true, count: results.length, results });
});

// @desc  Get full detail of one exam result (includes wrong answers + explanations)
// @route GET /api/exams/results/:id
// @access Private (owner, or staff/admin/masterAdmin for review)
const getResultDetail = asyncHandler(async (req, res) => {
  const result = await ExamResult.findById(req.params.id)
    .populate('course', 'name')
    .populate('topic', 'name')
    .populate('user', 'name email');

  if (!result) {
    res.status(404);
    throw new Error('Result not found.');
  }

  const isOwner = result.user._id.toString() === req.user._id.toString();
  const isReviewer = ['admin', 'masterAdmin', 'staff'].includes(req.user.role);

  if (!isOwner && !isReviewer) {
    res.status(403);
    throw new Error('Not authorized to view this result.');
  }

  res.json({ success: true, result });
});

// @desc  Simple weak-topic analysis for the logged-in user's dashboard
// @route GET /api/exams/performance
// @access Private
const getPerformanceSummary = asyncHandler(async (req, res) => {
  const results = await ExamResult.find({ user: req.user._id }).populate('topic', 'name');

  const byTopic = {};
  for (const r of results) {
    const key = r.topic ? r.topic.name : 'Unknown';
    if (!byTopic[key]) byTopic[key] = { attempts: 0, totalPercentage: 0 };
    byTopic[key].attempts += 1;
    byTopic[key].totalPercentage += r.percentage;
  }

  const topics = Object.entries(byTopic).map(([topic, stats]) => ({
    topic,
    attempts: stats.attempts,
    averagePercentage: Math.round((stats.totalPercentage / stats.attempts) * 100) / 100,
  }));

  const weakTopics = topics.filter((t) => t.averagePercentage < 50).sort((a, b) => a.averagePercentage - b.averagePercentage);

  res.json({
    success: true,
    totalExamsTaken: results.length,
    overallAverage: results.length
      ? Math.round((results.reduce((s, r) => s + r.percentage, 0) / results.length) * 100) / 100
      : 0,
    topics,
    weakTopics,
  });
});

module.exports = { startExam, instantCheck, submitExam, getHistory, getResultDetail, getPerformanceSummary };
