const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { readJSON, writeJSON } = require('../middleware/db');

const SETUP_LOCK_FILE = path.join(__dirname, '../data/setup.lock');

function isSetupDone() {
  return fs.existsSync(SETUP_LOCK_FILE);
}

// GET /setup
router.get('/', (req, res) => {
  if (isSetupDone()) {
    return res.status(404).render('error', {
      message: 'এই পেজটি আর পাওয়া যাবে না।',
      settings: req.app.locals.settings || {}
    });
  }
  res.render('setup', { error: null });
});

// POST /setup
router.post('/', async (req, res) => {
  if (isSetupDone()) {
    return res.status(404).render('error', {
      message: 'এই পেজটি আর পাওয়া যাবে না।',
      settings: req.app.locals.settings || {}
    });
  }

  const { name, email, phone, password, confirm_password } = req.body;

  if (!name || !email || !phone || !password || !confirm_password) {
    return res.render('setup', { error: 'সব ঘর পূরণ করুন' });
  }

  if (password !== confirm_password) {
    return res.render('setup', { error: 'পাসওয়ার্ড মিলছে না' });
  }

  if (password.length < 6) {
    return res.render('setup', { error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
  }

  const hashed = await bcrypt.hash(password, 12);
  const admin = {
    id: uuidv4(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    password: hashed,
    role: 'admin',
    banned: false,
    createdAt: new Date().toISOString()
  };

  const users = readJSON('users.json');
  users.push(admin);
  writeJSON('users.json', users);

  // Lock setup forever
  fs.writeFileSync(SETUP_LOCK_FILE, JSON.stringify({
    setupAt: new Date().toISOString(),
    adminEmail: admin.email
  }));

  // Auto login
  req.session.user = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: 'admin',
    phone: admin.phone
  };

  res.redirect('/admin');
});

module.exports = router;
