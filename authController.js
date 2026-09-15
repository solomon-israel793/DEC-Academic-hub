const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const User = require('./User');
const generateToken = require('./generateToken');

// @desc  Register a new student account (self-registration)
// @route POST /api/auth/register
// @access Public
const registerStudent = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email and password are required.');
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(400);
    throw new Error('An account with this email already exists.');
  }

  const user = await User.create({ name, email, phone, password, role: 'student' });

  res.status(201).json({
    success: true,
    user: user.toSafeObject(),
    token: generateToken(user._id),
  });
});

// @desc  Login with email + password (any role)
// @route POST /api/auth/login
// @access Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required.');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password.');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated. Contact an admin.');
  }

  res.json({
    success: true,
    user: user.toSafeObject(),
    token: generateToken(user._id),
  });
});

// @desc  Request a password reset token
// @route POST /api/auth/forgot-password
// @access Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });

  // Always respond the same way, whether or not the email exists,
  // so attackers can't use this to discover valid emails.
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a reset link has been generated.' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  await user.save();

  // In production, email this link via nodemailer (see utils/email.js if you add SMTP).
  // For now it's returned directly so it works out of the box without an email server.
  const resetUrl = `${process.env.CLIENT_URL || ''}/reset-password?token=${resetToken}`;

  res.json({
    success: true,
    message: 'If that email exists, a reset link has been generated.',
    devResetUrl: process.env.NODE_ENV !== 'production' ? resetUrl : undefined,
    devResetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
  });
});

// @desc  Reset password using the token from forgot-password
// @route POST /api/auth/reset-password
// @access Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    res.status(400);
    throw new Error('Token and newPassword are required.');
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpires');

  if (!user) {
    res.status(400);
    throw new Error('Reset token is invalid or has expired.');
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password has been reset. You can now log in.' });
});

module.exports = { registerStudent, login, forgotPassword, resetPassword };
