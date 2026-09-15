const asyncHandler = require('express-async-handler');
const Course = require('./Course');

// @route GET /api/courses  (any logged-in user)
const getCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ isActive: true }).sort({ name: 1 });
  res.json({ success: true, count: courses.length, courses });
});

// @route POST /api/courses  (admin, staff, masterAdmin)
const createCourse = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('Course name is required.');
  }
  const course = await Course.create({ name, description, createdBy: req.user._id });
  res.status(201).json({ success: true, course });
});

// @route PUT /api/courses/:id
const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error('Course not found.');
  }
  const { name, description, isActive } = req.body;
  if (name !== undefined) course.name = name;
  if (description !== undefined) course.description = description;
  if (isActive !== undefined) course.isActive = isActive;
  await course.save();
  res.json({ success: true, course });
});

// @route DELETE /api/courses/:id
const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error('Course not found.');
  }
  await course.deleteOne();
  res.json({ success: true, message: 'Course deleted.' });
});

module.exports = { getCourses, createCourse, updateCourse, deleteCourse };
