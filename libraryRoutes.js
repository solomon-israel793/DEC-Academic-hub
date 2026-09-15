const express = require('express');
const router = express.Router();
const { protect, authorize } = require('.auth');
const { uploadLibraryFile } = require('.upload');
const { uploadMaterial, getMaterials, deleteMaterial } = require('.libraryController');

router.use(protect);

router.get('/', getMaterials);
router.post('/', authorize('admin', 'staff', 'masterAdmin'), uploadLibraryFile.single('file'), uploadMaterial);
router.delete('/:id', authorize('admin', 'staff', 'masterAdmin'), deleteMaterial);

module.exports = router;
