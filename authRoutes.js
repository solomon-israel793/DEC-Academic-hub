const express = require('express');
const router = express.Router();
const { registerStudent, login, forgotPassword, resetPassword } = require('./authController');

router.post('/register', registerStudent);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
