const express = require('express');
const router = express.Router();
const { protect, authorize } = require('./auth');
const { createAdmin, createStaff, listUsers, setUserStatus, deleteUser } = require('./adminController');

router.use(protect);

router.post('/create-admin', authorize('masterAdmin'), createAdmin);
router.post('/create-staff', authorize('admin', 'masterAdmin'), createStaff);
router.get('/users', authorize('admin', 'masterAdmin', 'staff'), listUsers);
router.put('/users/:id/status', authorize('admin', 'masterAdmin'), setUserStatus);
router.delete('/users/:id', authorize('admin', 'masterAdmin'), deleteUser);

module.exports = router;
