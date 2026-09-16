require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const connectDB = require('./db');
const { notFound, errorHandler } = require('./errorHandler');

// --- ROUTES ---
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const courseRoutes = require('./courseRoutes');
const topicRoutes = require('./topicRoutes');
const questionRoutes = require('./questionRoutes');
const examRoutes = require('./examRoutes');
const libraryRoutes = require('./libraryRoutes');
const userRoutes = require('./userRoutes');

// --- ENSURE UPLOADS FOLDER EXISTS ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) { console.warn('⚠️ Could not create uploads folder'); }
}

// --- DATABASE CONNECTION with error handling ---
connectDB().catch(err => {
  console.error('❌ Database connection failed on startup:', err.message);
  // Don't exit — let retry keep trying instead
});

const app = express();

// --- Security & basics ---
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
}));
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// --- Rate limiting ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — try again later' }
});
app.use('/api/auth', authLimiter);

// --- Static files ---
app.use('/uploads', express.static(uploadsDir));

// --- Frontend files ---
const FRONTEND_FILES = ['index.html', 'style.css', 'app.js', 'manifest.json'];
FRONTEND_FILES.forEach((file) => {
  const filePath = path.join(__dirname, file);
  app.get('/' + file, (req, res) => {
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    res.status(404).json({ success: false, message: 'File not found' });
  });
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

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dec Academic CBT Hub API is running ✅',
    timestamp: new Date().toISOString()
  });
});

// --- SPA fallback ---
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) return next();
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(200).send('API is running — index.html not found');
});

// --- Error handlers ---
app.use(notFound);
app.use(errorHandler);

// --- SERVER START ---
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Dec Academic CBT Hub API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// --- GRACEFUL SHUTDOWN — prevent crashes on server restart ---
process.on('SIGTERM', () => {
  console.log('📤 SIGTERM received — shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT — shutting down');
  server.close(() => process.exit(0));
});

// --- Catch unhandled errors to prevent full crash ---
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err.message);
  // Don't exit — keep server running
});

process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION:', err.message);
  // Don't exit — keep server running
});

module.exports = app;
