require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const connectDB = require('db.js');
const { notFound, errorHandler } = require('errorHandler.js');

const authRoutes = require('authRoutes.js');
const adminRoutes = require('adminRoutes.js');
const courseRoutes = require('courseRoutes.js');
const topicRoutes = require('topicRoutes.js');
const questionRoutes = require('questionRoutes.js');
const examRoutes = require('examRoutes.js');
const libraryRoutes = require('libraryRoutes.js');
const userRoutes = require('userRoutes.js');

connectDB();

const app = express();

// --- Security & basics ---
app.use(helmet({ crossOriginResourcePolicy: false })); // allow serving uploaded PDFs/images cross-origin
app.use(cors()); // open by default so the mobile app / web frontend can call it from anywhere
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Basic rate limiting on auth routes to slow down brute-force login attempts
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
app.use('/api/auth.js', authLimiter);

// --- Static file serving for uploaded images & PDFs ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Serve the responsive web/mobile frontend ---
// NOTE: since everything now lives in one folder, we whitelist the exact
// frontend files instead of statically serving the whole directory - that
// keeps server-side source files (and anything like a real .env, if one is
// ever added here) from being served to browsers.
const FRONTEND_FILES = ['index.html', 'style.css', 'app.js', 'manifest.json'];
FRONTEND_FILES.forEach((file) => {
  app.get('/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
});

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Dec Academic Hub API is running.' }));

// Any non-API route falls back to the frontend app (so phone browsers/PWA routing works)
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Dec Academic CBT Hub API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
