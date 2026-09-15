const asyncHandler = require('express-async-handler');
const Topic = require('./Topic');

// @route GET /api/topics?course=<courseId>
const getTopics = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.course) filter.course = req.query.course;
  const topics = await Topic.find(filter).populate('course', 'name').sort({ name: 1 });
  res.json({ success: true, count: topics.length, topics });
});

// @route POST /api/topics
const createTopic = asyncHandler(async (req, res) => {
  const { name, course, description } = req.body;
  if (!name || !course) {
    res.status(400);
    throw new Error('Topic name and course are required.');
  }
  const topic = await Topic.create({ name, course, description, createdBy: req.user._id });
  res.status(201).json({ success: true, topic });
});

// @route PUT /api/topics/:id
const updateTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findById(req.params.id);
  if (!topic) {
    res.status(404);
    throw new Error('Topic not found.');
  }
  const { name, description } = req.body;
  if (name !== undefined) topic.name = name;
  if (description !== undefined) topic.description = description;
  await topic.save();
  res.json({ success: true, topic });
});

// @route DELETE /api/topics/:id
const deleteTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findById(req.params.id);
  if (!topic) {
    res.status(404);
    throw new Error('Topic not found.');
  }
  await topic.deleteOne();
  res.json({ success: true, message: 'Topic deleted.' });
});

module.exports = { getTopics, createTopic, updateTopic, deleteTopic };
