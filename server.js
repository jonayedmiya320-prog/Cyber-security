const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { readSettings } = require('./middleware/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'অনেকবার চেষ্টা করা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।'
});

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'mcl-super-secret-2025-xk9z',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Load settings into locals
app.use((req, res, next) => {
  const settings = readSettings();
  app.locals.settings = settings;
  res.locals.settings = settings;
  res.locals.user = req.session.user || null;
  next();
});

// Ensure uploads dir exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// Routes
app.use('/setup', require('./routes/setup'));
app.use('/', require('./routes/public'));
app.use('/auth', authLimiter, require('./routes/auth'));
app.use('/dashboard', require('./routes/user'));
app.use('/admin', require('./routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    message: 'পেজটি পাওয়া যায়নি (404)',
    settings: res.locals.settings
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    message: 'সার্ভার এরর হয়েছে। আবার চেষ্টা করুন।',
    settings: res.locals.settings
  });
});

app.listen(PORT, () => {
  const SETUP_LOCK = path.join(__dirname, 'data/setup.lock');
  if (!fs.existsSync(SETUP_LOCK)) {
    console.log('======================================');
    console.log('প্রথমবার চালু হয়েছে!');
    console.log('অ্যাডমিন সেটআপ করুন: /setup');
    console.log('======================================');
  }
  console.log(`MYMENSINGH CYBER LAB running on port ${PORT}`);
});
