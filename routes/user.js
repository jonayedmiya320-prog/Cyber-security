const express = require('express');
const router = express.Router();
const { readJSON } = require('../middleware/db');
const { isLoggedIn } = require('../middleware/auth');

router.use(isLoggedIn);

// GET /dashboard
router.get('/', (req, res) => {
  const orders = readJSON('orders.json').filter(o => o.userId === req.session.user.id);
  const pending = orders.filter(o => o.status === 'pending').length;
  const approved = orders.filter(o => o.status === 'approved').length;
  const rejected = orders.filter(o => o.status === 'rejected').length;
  res.render('dashboard', { orders: orders.slice(0, 5), pending, approved, rejected });
});

// GET /dashboard/orders
router.get('/orders', (req, res) => {
  const allOrders = readJSON('orders.json').filter(o => o.userId === req.session.user.id);
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const total = allOrders.length;
  const totalPages = Math.ceil(total / perPage);
  const orders = allOrders.slice((page - 1) * perPage, page * perPage);
  res.render('orders', { orders, page, totalPages, total });
});

// GET /dashboard/orders/:id
router.get('/orders/:id', (req, res) => {
  const orders = readJSON('orders.json');
  const order = orders.find(o => o.id === req.params.id && o.userId === req.session.user.id);
  if (!order) {
    return res.status(404).render('error', { message: 'অর্ডার পাওয়া যায়নি', settings: res.locals.settings });
  }
  res.render('order-detail', { order });
});

module.exports = router;
