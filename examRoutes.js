const express = require('express');
const router = express.Router();
const { protect } = require('./auth');
const {
  startExam, instantCheck, submitExam, getHistory, getResultDetail, getPerformanceSummary,
} = require('./examController');

router.use(protect);

router.get('/start', startExam);
router.post('/instant/check', instantCheck);
router.post('/submit', submitExam);
router.get('/history', getHistory);
router.get('/performance', getPerformanceSummary);
router.get('/results/:id', getResultDetail);

module.exports = router;
