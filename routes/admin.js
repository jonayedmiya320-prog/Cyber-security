const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readJSON, writeJSON, readSettings, writeSettings } = require('../middleware/db');
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

// ===== MULTER SETUP =====
const productUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      let dir;
      if (file.fieldname === 'image') {
        dir = path.join(__dirname, '../uploads');
      } else {
        dir = path.join(__dirname, '../uploads/products');
      }
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, uuidv4() + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 200 * 1024 * 1024 }
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'productFile', maxCount: 1 }
]);

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, uuidv4() + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('logoImage');

// ========== DASHBOARD ==========
router.get('/', (req, res) => {
  const users = readJSON('users.json');
  const products = readJSON('products.json');
  const orders = readJSON('orders.json');
  const pending = orders.filter(o => o.status === 'pending').length;
  const approved = orders.filter(o => o.status === 'approved').length;
  const rejected = orders.filter(o => o.status === 'rejected').length;
  const totalRevenue = orders
    .filter(o => o.status === 'approved')
    .reduce((s, o) => s + (o.total || 0), 0);
  const recentOrders = orders.slice(-5).reverse();
  res.render('admin/index', {
    totalUsers: users.length,
    totalProducts: products.length,
    totalOrders: orders.length,
    pending, approved, rejected,
    totalRevenue, recentOrders
  });
});

// ========== PRODUCTS ==========
router.get('/products', (req, res) => {
  let products = readJSON('products.json');
  const categories = readJSON('categories.json');
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  if (search) {
    const s = search.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(s));
  }
  const total = products.length;
  const totalPages = Math.ceil(total / perPage);
  const paginated = products.reverse().slice((page - 1) * perPage, page * perPage);
  res.render('admin/products', {
    products: paginated, categories, search,
    page, totalPages, total,
    error: null, success: null,
    successMsg: req.query.success ? true : false
  });
});

router.get('/products/add', (req, res) => {
  const categories = readJSON('categories.json');
  res.render('admin/add-product', { categories, error: null, product: null });
});

router.post('/products/add', (req, res) => {
  productUpload(req, res, (err) => {
    const categories = readJSON('categories.json');
    if (err) {
      return res.render('admin/add-product', {
        categories,
        error: 'ফাইল আপলোড এরর: ' + err.message,
        product: null
      });
    }
    const { name, description, price, stock, categoryId, active } = req.body;
    if (!name || !price || !categoryId) {
      return res.render('admin/add-product', {
        categories,
        error: 'নাম, দাম ও ক্যাটাগরি আবশ্যক',
        product: null
      });
    }
    const products = readJSON('products.json');
    const newProduct = {
      id: uuidv4(),
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      categoryId,
      image: req.files && req.files['image']
        ? '/uploads/' + req.files['image'][0].filename
        : '',
      productFile: req.files && req.files['productFile']
        ? '/uploads/products/' + req.files['productFile'][0].filename
        : '',
      productFileName: req.files && req.files['productFile']
        ? req.files['productFile'][0].originalname
        : '',
      active: active === 'on' || active === 'true',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    products.push(newProduct);
    writeJSON('products.json', products);
    res.redirect('/admin/products?success=1');
  });
});

router.get('/products/edit/:id', (req, res) => {
  const products = readJSON('products.json');
  const categories = readJSON('categories.json');
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.redirect('/admin/products');
  res.render('admin/edit-product', { product, categories, error: null });
});

router.post('/products/edit/:id', (req, res) => {
  productUpload(req, res, (err) => {
    const products = readJSON('products.json');
    const categories = readJSON('categories.json');
    const idx = products.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.redirect('/admin/products');
    const { name, description, price, stock, categoryId, active } = req.body;
    const product = products[idx];
    if (!name || !price || !categoryId) {
      return res.render('admin/edit-product', {
        product, categories,
        error: 'নাম, দাম ও ক্যাটাগরি আবশ্যক'
      });
    }
    products[idx] = {
      ...product,
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      categoryId,
      image: req.files && req.files['image']
        ? '/uploads/' + req.files['image'][0].filename
        : product.image,
      productFile: req.files && req.files['productFile']
        ? '/uploads/products/' + req.files['productFile'][0].filename
        : product.productFile,
      productFileName: req.files && req.files['productFile']
        ? req.files['productFile'][0].originalname
        : product.productFileName,
      active: active === 'on' || active === 'true',
      updatedAt: new Date().toISOString()
    };
    writeJSON('products.json', products);
    res.redirect('/admin/products?success=1');
  });
});

router.post('/products/delete/:id', (req, res) => {
  let products = readJSON('products.json');
  products = products.filter(p => p.id !== req.params.id);
  writeJSON('products.json', products);
  res.redirect('/admin/products');
});

router.post('/products/toggle/:id', (req, res) => {
  const products = readJSON('products.json');
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx !== -1) {
    products[idx].active = !products[idx].active;
    writeJSON('products.json', products);
  }
  res.redirect('/admin/products');
});

// ========== CATEGORIES ==========
router.get('/categories', (req, res) => {
  const categories = readJSON('categories.json');
  res.render('admin/categories', { categories, error: null, success: null });
});

router.post('/categories/add', (req, res) => {
  const { name } = req.body;
  if (!name) return res.redirect('/admin/categories');
  const categories = readJSON('categories.json');
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  categories.push({ id: uuidv4(), name: name.trim(), slug });
  writeJSON('categories.json', categories);
  res.redirect('/admin/categories');
});

router.post('/categories/delete/:id', (req, res) => {
  let categories = readJSON('categories.json');
  categories = categories.filter(c => c.id !== req.params.id);
  writeJSON('categories.json', categories);
  res.redirect('/admin/categories');
});

// ========== ORDERS ==========
router.get('/orders', (req, res) => {
  let orders = readJSON('orders.json').reverse();
  const status = req.query.status || '';
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  if (status) orders = orders.filter(o => o.status === status);
  if (search) {
    const s = search.toLowerCase();
    orders = orders.filter(o =>
      o.transactionId.toLowerCase().includes(s) ||
      o.userEmail.toLowerCase().includes(s) ||
      o.userName.toLowerCase().includes(s)
    );
  }
  const total = orders.length;
  const totalPages = Math.ceil(total / perPage);
  const paginated = orders.slice((page - 1) * perPage, page * perPage);
  res.render('admin/orders', {
    orders: paginated, status, search,
    page, totalPages, total
  });
});

router.get('/orders/:id', (req, res) => {
  const orders = readJSON('orders.json');
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.redirect('/admin/orders');
  res.render('admin/order-detail', { order, error: null, success: null });
});

router.post('/orders/:id/approve', (req, res) => {
  const orders = readJSON('orders.json');
  const products = readJSON('products.json');
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.redirect('/admin/orders');
  orders[idx].status = 'approved';
  orders[idx].updatedAt = new Date().toISOString();
  orders[idx].items.forEach(item => {
    const pIdx = products.findIndex(p => p.id === item.productId);
    if (pIdx !== -1 && products[pIdx].stock > 0) {
      products[pIdx].stock -= 1;
    }
  });
  writeJSON('orders.json', orders);
  writeJSON('products.json', products);
  res.redirect('/admin/orders/' + req.params.id);
});

router.post('/orders/:id/reject', (req, res) => {
  const orders = readJSON('orders.json');
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx !== -1) {
    orders[idx].status = 'rejected';
    orders[idx].rejectReason = req.body.reason || '';
    orders[idx].updatedAt = new Date().toISOString();
    writeJSON('orders.json', orders);
  }
  res.redirect('/admin/orders/' + req.params.id);
});

// ========== USERS ==========
router.get('/users', (req, res) => {
  let users = readJSON('users.json');
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  if (search) {
    const s = search.toLowerCase();
    users = users.filter(u =>
      u.email.toLowerCase().includes(s) ||
      u.name.toLowerCase().includes(s)
    );
  }
  const total = users.length;
  const totalPages = Math.ceil(total / perPage);
  const paginated = users.reverse().slice((page - 1) * perPage, page * perPage);
  res.render('admin/users', {
    users: paginated, search,
    page, totalPages, total
  });
});

router.post('/users/:id/ban', (req, res) => {
  const users = readJSON('users.json');
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx !== -1) {
    users[idx].banned = !users[idx].banned;
    writeJSON('users.json', users);
  }
  res.redirect('/admin/users');
});

router.post('/users/:id/delete', (req, res) => {
  let users = readJSON('users.json');
  users = users.filter(u => u.id !== req.params.id);
  writeJSON('users.json', users);
  res.redirect('/admin/users');
});

// ========== SETTINGS ==========
router.get('/settings', (req, res) => {
  const settings = readSettings();
  res.render('admin/settings', { settings, error: null, success: null });
});

router.post('/settings', (req, res) => {
  logoUpload(req, res, (err) => {
    const settings = readSettings();
    const {
      siteName, siteTagline, logoText,
      bkashNumber, nagadNumber, rocketNumber,
      bkashInstructions, nagadInstructions,
      footerText, contactEmail, contactPhone
    } = req.body;
    const updated = {
      ...settings,
      siteName: siteName || settings.siteName,
      siteTagline: siteTagline || '',
      logoText: logoText || settings.logoText,
      bkashNumber: bkashNumber || '',
      nagadNumber: nagadNumber || '',
      rocketNumber: rocketNumber || '',
      bkashInstructions: bkashInstructions || '',
      nagadInstructions: nagadInstructions || '',
      footerText: footerText || '',
      contactEmail: contactEmail || '',
      contactPhone: contactPhone || ''
    };
    if (req.file) {
      updated.logoImage = '/uploads/' + req.file.filename;
    }
    writeSettings(updated);
    res.locals.settings = updated;
    req.app.locals.settings = updated;
    res.render('admin/settings', {
      settings: updated,
      error: null,
      success: 'সেটিংস আপডেট হয়েছে!'
    });
  });
});

// ========== FILE DOWNLOAD (Admin) ==========
router.get('/download/:id', (req, res) => {
  const products = readJSON('products.json');
  const product = products.find(p => p.id === req.params.id);
  if (!product || !product.productFile) {
    return res.status(404).render('error', {
      message: 'ফাইল পাওয়া যায়নি',
      settings: req.app.locals.settings || {}
    });
  }
  const filePath = path.join(__dirname, '..', product.productFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).render('error', {
      message: 'ফাইল সার্ভারে নেই',
      settings: req.app.locals.settings || {}
    });
  }
  res.download(filePath, product.productFileName || 'download');
});

module.exports = router;