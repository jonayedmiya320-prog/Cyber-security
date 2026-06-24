// Auth middleware

function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).render('error', {
    message: 'এই পেজে প্রবেশাধিকার নেই',
    settings: req.app.locals.settings || {}
  });
}

function isNotLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { isLoggedIn, isAdmin, isNotLoggedIn };
