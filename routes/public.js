const express = require('express');
const router = express.Router();
const { readJSON, readSettings } = require('../middleware/db');

// GET / - Home
router.get('/', (req, res) => {
  const products = readJSON('products.json');
  const categories = readJSON('categories.json');
  const featured = products.filter(p => p.active).slice(0, 8);
  res.render('index', { products: featured, categories });
});

// GET /products - All products with pagination & search
router.get('/products', (req, res) => {
  let products = readJSON('products.json').filter(p => p.active);
  const categories = readJSON('categories.json');

  const search = req.query.search || '';
  const category = req.query.category || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;

  if (search) {
    const s = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(s) ||
      p.description.toLowerCase().includes(s)
    );
  }

  if (category) {
    products = products.filter(p => p.categoryId === category);
  }

  const total = products.length;
  const totalPages = Math.ceil(total / perPage);
  const paginated = products.slice((page - 1) * perPage, page * perPage);

  res.render('products', {
    products: paginated,
    categories,
    search,
    category,
    page,
    totalPages,
    total
  });
});

// GET /products/:id - Product detail
router.get('/products/:id', (req, res) => {
  const products = readJSON('products.json');
  const product = products.find(p => p.id === req.params.id && p.active);
  if (!product) {
    return res.status(404).render('error', { message: 'প্রোডাক্ট পাওয়া যায়নি', settings: res.locals.settings });
  }
  const categories = readJSON('categories.json');
  const cat = categories.find(c => c.id === product.categoryId);
  res.render('product-detail', { product, category: cat || null });
});

// POST /cart/add
router.post('/cart/add', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  const { productId } = req.body;
  const products = readJSON('products.json');
  const product = products.find(p => p.id === productId && p.active);
  if (!product) {
    return res.redirect('/products');
  }

  if (!req.session.cart) req.session.cart = [];
  const exists = req.session.cart.find(i => i.productId === productId);
  if (!exists) {
    req.session.cart.push({ productId, name: product.name, price: product.price, image: product.image });
  }

  res.redirect('/cart');
});

// GET /cart
router.get('/cart', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const cart = req.session.cart || [];
  res.render('cart', { cart });
});

// POST /cart/remove
router.post('/cart/remove', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const { productId } = req.body;
  req.session.cart = (req.session.cart || []).filter(i => i.productId !== productId);
  res.redirect('/cart');
});

// GET /checkout
router.get('/checkout', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');

  const settings = readSettings();
  const orders = readJSON('orders.json');

  // Check pending order
  const pendingOrder = orders.find(o =>
    o.userId === req.session.user.id &&
    o.status === 'pending'
  );

  res.render('checkout', { cart, settings, pendingOrder: pendingOrder || null, error: null, success: null });
});

// POST /checkout
router.post('/checkout', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');

  const settings = readSettings();
  const { payment_method, transaction_id, sender_number } = req.body;
  const orders = readJSON('orders.json');

  // Check pending order
  const pendingOrder = orders.find(o =>
    o.userId === req.session.user.id &&
    o.status === 'pending'
  );

  if (pendingOrder) {
    return res.render('checkout', {
      cart, settings, pendingOrder,
      error: 'আপনার একটি অর্ডার অ্যাপ্রুভের অপেক্ষায় আছে। আগে সেটি সম্পন্ন হোক।',
      success: null
    });
  }

  if (!payment_method || !transaction_id || !sender_number) {
    return res.render('checkout', {
      cart, settings, pendingOrder: null,
      error: 'সব তথ্য পূরণ করুন',
      success: null
    });
  }

  // Duplicate transaction ID check
  const dupTxn = orders.find(o => o.transactionId === transaction_id.trim());
  if (dupTxn) {
    return res.render('checkout', {
      cart, settings, pendingOrder: null,
      error: 'এই Transaction ID আগে ব্যবহার হয়েছে। সঠিক Transaction ID দিন।',
      success: null
    });
  }

  const total = cart.reduce((sum, i) => sum + parseFloat(i.price), 0);

  const { v4: uuidv4 } = require('uuid');
  const newOrder = {
    id: uuidv4(),
    userId: req.session.user.id,
    userName: req.session.user.name,
    userEmail: req.session.user.email,
    userPhone: req.session.user.phone,
    items: cart,
    total,
    paymentMethod: payment_method,
    transactionId: transaction_id.trim(),
    senderNumber: sender_number.trim(),
    status: 'pending',
    downloadLinks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  orders.push(newOrder);
  const { writeJSON } = require('../middleware/db');
  writeJSON('orders.json', orders);

  req.session.cart = [];

  res.render('checkout', {
    cart: [], settings, pendingOrder: null,
    error: null,
    success: 'অর্ডার সফলভাবে জমা হয়েছে! অ্যাডমিন অ্যাপ্রুভ করলে ডাউনলোড লিংক পাবেন।'
  });
});

module.exports = router;
