const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const { readSettings } = require('./middleware/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'mcl-super-secret-2025-xk9z',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  const settings = readSettings();
  app.locals.settings = settings;
  res.locals.settings = settings;
  res.locals.user = req.session.user || null;
  next();
});

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}
if (!fs.existsSync(path.join(__dirname, 'uploads/products'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads/products'), { recursive: true });
}

// Routes
app.use('/setup', require('./routes/setup'));
app.use('/', require('./routes/public'));
app.use('/auth', authLimiter, require('./routes/auth'));
app.use('/dashboard', require('./routes/user'));
app.use('/admin', require('./routes/admin'));

// ===== SOCKET.IO LIVE CHAT =====
const chatMessages = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ userId, userName, isAdmin }) => {
    socket.join(userId);
    socket.userId = userId;
    socket.userName = userName;
    socket.isAdmin = isAdmin;
    if (isAdmin) socket.join('admin');
    const msgs = chatMessages[userId] || [];
    socket.emit('loadMessages', msgs);
  });

  socket.on('userMessage', ({ userId, userName, message }) => {
    const msg = {
      from: 'user',
      userName,
      message,
      time: new Date().toLocaleTimeString('bn-BD')
    };
    if (!chatMessages[userId]) chatMessages[userId] = [];
    chatMessages[userId].push(msg);
    io.to(userId).emit('newMessage', msg);
    io.to('admin').emit('newUserMessage', { userId, userName, msg });
  });

  socket.on('adminMessage', ({ userId, message }) => {
    const msg = {
      from: 'admin',
      userName: 'Admin',
      message,
      time: new Date().toLocaleTimeString('bn-BD')
    };
    if (!chatMessages[userId]) chatMessages[userId] = [];
    chatMessages[userId].push(msg);
    io.to(userId).emit('newMessage', msg);
    socket.emit('messageSent', msg);
  });

  socket.on('getChats', () => {
    if (socket.isAdmin) {
      socket.emit('allChats', chatMessages);
    }
  });
});

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    message: 'পেজটি পাওয়া যায়নি (404)',
    settings: res.locals.settings
  });
});

// Error
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    message: 'সার্ভার এরর হয়েছে।',
    settings: res.locals.settings
  });
});

server.listen(PORT, () => {
  const SETUP_LOCK = path.join(__dirname, 'data/setup.lock');
  if (!fs.existsSync(SETUP_LOCK)) {
    console.log('প্রথমবার: /setup এ যান');
  }
  console.log(`MYMENSINGH CYBER LAB running on port ${PORT}`);
});