const asyncHandler = require('express-async-handler');
const User = require('./User');

// @desc  Master Admin creates an Admin account
// @route POST /api/admin/create-admin
// @access Private (masterAdmin only)
const createAdmin = asyncHandler(async (req, res) => {
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

  const admin = await User.create({
    name, email, phone, password,
    role: 'admin',
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, user: admin.toSafeObject() });
});

// @desc  Admin (or Master Admin) creates a Staff account
// @route POST /api/admin/create-staff
// @access Private (admin, masterAdmin)
const createStaff = asyncHandler(async (req, res) => {
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

  const staff = await User.create({
    name, email, phone, password,
    role: 'staff',
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, user: staff.toSafeObject() });
});

// @desc  List all users (optionally filter by role)
// @route GET /api/admin/users?role=student
// @access Private (staff can view students only; admin/masterAdmin see all)
const listUsers = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === 'staff') {
    filter.role = 'student'; // staff have limited admin rights - students only
  } else if (req.query.role) {
    filter.role = req.query.role;
  }

  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, count: users.length, users: users.map((u) => u.toSafeObject()) });
});

// @desc  Deactivate or reactivate a user account
// @route PUT /api/admin/users/:id/status
// @access Private (admin, masterAdmin)
const setUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const target = await User.findById(req.params.id);

  if (!target) {
    res.status(404);
    throw new Error('User not found.');
  }

  // Guard rails: admins cannot deactivate the Master Admin or other admins
  if (req.user.role === 'admin' && ['admin', 'masterAdmin'].includes(target.role)) {
    res.status(403);
    throw new Error('Admins cannot modify other admin accounts. Only Master Admin can.');
  }
  if (target.role === 'masterAdmin') {
    res.status(403);
    throw new Error('The Master Admin account cannot be deactivated.');
  }

  target.isActive = !!isActive;
  await target.save();

  res.json({ success: true, user: target.toSafeObject() });
});

// @desc  Delete a user account
// @route DELETE /api/admin/users/:id
// @access Private (admin, masterAdmin)
const deleteUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) {
    res.status(404);
    throw new Error('User not found.');
  }

  if (req.user.role === 'admin' && ['admin', 'masterAdmin'].includes(target.role)) {
    res.status(403);
    throw new Error('Admins cannot delete other admin accounts. Only Master Admin can.');
  }
  if (target.role === 'masterAdmin') {
    res.status(403);
    throw new Error('The Master Admin account cannot be deleted.');
  }

  await target.deleteOne();
  res.json({ success: true, message: 'User deleted.' });
});

module.exports = { createAdmin, createStaff, listUsers, setUserStatus, deleteUser };
