// Run once, right after setup: `npm run seed:masteradmin`
// Creates the single Master Admin account from the .env values.
// Safe to run multiple times - it won't create a second one.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');
const User = require('./User');

(async () => {
  await connectDB();

  const existing = await User.findOne({ role: 'masterAdmin' });
  if (existing) {
    console.log(`⚠️  A Master Admin already exists: ${existing.email}. Nothing created.`);
    process.exit(0);
  }

  const { MASTER_ADMIN_NAME, MASTER_ADMIN_EMAIL, MASTER_ADMIN_PASSWORD, MASTER_ADMIN_PHONE } = process.env;

  if (!MASTER_ADMIN_EMAIL || !MASTER_ADMIN_PASSWORD) {
    console.error('❌ Set MASTER_ADMIN_EMAIL and MASTER_ADMIN_PASSWORD in your .env file first.');
    process.exit(1);
  }

  const masterAdmin = await User.create({
    name: MASTER_ADMIN_NAME || 'MasterAdmin',
    email: MASTER_ADMIN_EMAIL || 'solomonisrael793@gmail.com',
    phone: MASTER_ADMIN_PHONE || '08064687282',
    password: MASTER_ADMIN_PASSWORD || 'solo08064',
    role: 'masterAdmin',
  });

  console.log(`✅ Master Admin created: ${masterAdmin.email}`);
  console.log('   Log in with this email + the password you set in .env, then change it from the app.');
  process.exit(0);
})();
