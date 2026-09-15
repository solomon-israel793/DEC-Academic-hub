const express = require('express');
const router = express.Router();
const { protect, authorize } = require('.auth');
const { uploadQuestionImage } = require('.upload');
const {
  createQuestion, bulkCreateQuestions, getQuestions, updateQuestion, deleteQuestion,
} = require('.questionController');

router.use(protect);

router.get('/', getQuestions);
router.post('/', authorize('admin', 'staff', 'masterAdmin'), uploadQuestionImage.single('image'), createQuestion);
router.post('/bulk', authorize('admin', 'staff', 'masterAdmin'), bulkCreateQuestions);
router.put('/:id', authorize('admin', 'staff', 'masterAdmin'), uploadQuestionImage.single('image'), updateQuestion);
router.delete('/:id', authorize('admin', 'staff', 'masterAdmin'), deleteQuestion);

module.exports = router;
