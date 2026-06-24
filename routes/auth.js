const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../middleware/db');
const { isNotLoggedIn } = require('../middleware/auth');

// GET /auth/login
router.get('/login', isNotLoggedIn, (req, res) => {
  res.render('login', { error: null, success: null });
});

// POST /auth/login
router.post('/login', isNotLoggedIn, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render('login', { error: 'সব ঘর পূরণ করুন', success: null });
  }

  const users = readJSON('users.json');
  const user = users.find(u => u.email === email.toLowerCase().trim());

  if (!user) {
    return res.render('login', { error: 'ইমেইল বা পাসওয়ার্ড ভুল', success: null });
  }

  if (user.banned) {
    return res.render('login', { error: 'আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে', success: null });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.render('login', { error: 'ইমেইল বা পাসওয়ার্ড ভুল', success: null });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone
  };

  if (user.role === 'admin') {
    return res.redirect('/admin');
  }

  const returnTo = req.session.returnTo || '/dashboard';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

// GET /auth/register
router.get('/register', isNotLoggedIn, (req, res) => {
  res.render('register', { error: null, success: null });
});

// POST /auth/register
router.post('/register', isNotLoggedIn, async (req, res) => {
  const { name, email, phone, password, confirm_password } = req.body;

  if (!name || !email || !phone || !password || !confirm_password) {
    return res.render('register', { error: 'সব ঘর পূরণ করুন', success: null });
  }

  if (password !== confirm_password) {
    return res.render('register', { error: 'পাসওয়ার্ড মিলছে না', success: null });
  }

  if (password.length < 6) {
    return res.render('register', { error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', success: null });
  }

  const users = readJSON('users.json');
  const exists = users.find(u => u.email === email.toLowerCase().trim());
  if (exists) {
    return res.render('register', { error: 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে', success: null });
  }

  const hashed = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    password: hashed,
    role: 'user',
    banned: false,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeJSON('users.json', users);

  res.render('register', { error: null, success: 'অ্যাকাউন্ট তৈরি হয়েছে! এখন লগইন করুন।' });
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
