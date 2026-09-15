const asyncHandler = require('express-async-handler');
const User = require('./User');

// @desc  Get my own profile
// @route GET /api/users/me
// @access Private
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

// @desc  Update my own profile (name/phone only - not email or role)
// @route PUT /api/users/me
// @access Private
const updateMe = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  res.json({ success: true, user: req.user.toSafeObject() });
});

// @desc  Change my own password
// @route PUT /api/users/me/password
// @access Private
const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('currentPassword and newPassword are required.');
  }

  const user = await User.findById(req.user._id).select('+password');
  const matches = await user.matchPassword(currentPassword);

  if (!matches) {
    res.status(401);
    throw new Error('Current password is incorrect.');
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated.' });
});

module.exports = { getMe, updateMe, changeMyPassword };
