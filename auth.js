const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('.User');

// Verifies the JWT sent in the Authorization header and attaches req.user.
// This is what guarantees "no one can access another user's records" -
// every protected route knows exactly who is calling it.
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized. Please log in.');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user || !req.user.isActive) {
      res.status(401);
      throw new Error('Account not found or deactivated.');
    }

    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized. Token invalid or expired.');
  }
});

// Usage: authorize('admin', 'masterAdmin')
// Restricts a route to specific roles.
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`Role '${req.user ? req.user.role : 'guest'}' is not allowed to do this.`);
    }
    next();
  };
};

module.exports = { protect, authorize };
