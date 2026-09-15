const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Library = require('./Library');

// @desc  Upload a PDF study material
// @route POST /api/library
// @access Private (admin, staff, masterAdmin)
const uploadMaterial = asyncHandler(async (req, res) => {
  const { title, description, course } = req.body;

  if (!title || !course) {
    res.status(400);
    throw new Error('title and course are required.');
  }
  if (!req.file) {
    res.status(400);
    throw new Error('A PDF file is required.');
  }

  const material = await Library.create({
    title,
    description,
    course,
    fileUrl: `/uploads/library/${req.file.filename}`,
    fileSizeKB: Math.round(req.file.size / 1024),
    uploadedBy: req.user._id,
  });

  res.status(201).json({ success: true, material });
});

// @desc  Browse library, optionally filtered by course
// @route GET /api/library?course=<courseId>
// @access Private (any logged-in user)
const getMaterials = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.course) filter.course = req.query.course;

  const materials = await Library.find(filter).populate('course', 'name').sort({ createdAt: -1 });
  res.json({ success: true, count: materials.length, materials });
});

// @desc  Delete a library item (also removes the file from disk)
// @route DELETE /api/library/:id
// @access Private (admin, staff, masterAdmin)
const deleteMaterial = asyncHandler(async (req, res) => {
  const material = await Library.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error('Material not found.');
  }

  const filePath = path.join(__dirname, material.fileUrl);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await material.deleteOne();
  res.json({ success: true, message: 'Material deleted.' });
});

module.exports = { uploadMaterial, getMaterials, deleteMaterial };
