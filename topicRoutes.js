const express = require('express');
const router = express.Router();
const { protect, authorize } = require('.auth');
const { getTopics, createTopic, updateTopic, deleteTopic } = require('.topicController');

router.use(protect);

router.get('/', getTopics);
router.post('/', authorize('admin', 'staff', 'masterAdmin'), createTopic);
router.put('/:id', authorize('admin', 'staff', 'masterAdmin'), updateTopic);
router.delete('/:id', authorize('admin', 'masterAdmin'), deleteTopic);

module.exports = router;
