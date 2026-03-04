'use strict';

const express  = require('express');
const multer   = require('multer');
const { parse } = require('csv-parse/sync');
const path     = require('path');
const fs       = require('fs');
const db       = require('../database');
const { requireAdmin } = require('../middleware/auth');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Ensure uploads directory exists (persisted via Docker volume at /app/data)
const UPLOADS_DIR = path.join(__dirname, '../data/uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Image upload: saves to data/uploads/
// NOTE: req.body is not yet parsed when multer's filename() runs in multipart forms,
// so we write a temp file and rename it in the route handler once req.body.slot is available.
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, '_tmp_' + Date.now() + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── GET /admin ───────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  if (req.session && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  res.redirect('/admin/login');
});

// ── GET /admin/login ─────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/admin/dashboard');
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

// ── POST /admin/login ────────────────────────────────────────────────────────

router.post('/login', express.urlencoded({ extended: false }), (req, res) => {
  const { username, password } = req.body;
  if (
    username === 'admin' &&
    password === 'bss@5432'
  ) {
    req.session.admin = true;
    return res.redirect('/admin/dashboard');
  }
  res.redirect('/admin/login?error=1');
});

// ── GET /admin/logout ────────────────────────────────────────────────────────

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ── GET /admin/dashboard ─────────────────────────────────────────────────────

router.get('/dashboard', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// ── POST /admin/upload ───────────────────────────────────────────────────────
// Accepts a CSV file with columns: name, email, order_number
// Columns can be in any order; header row is required.

router.post('/upload', requireAdmin, upload.single('csv'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file uploaded.' });
  }

  let records;
  try {
    records = parse(req.file.buffer.toString('utf8'), {
      columns: true,          // use first row as column names
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Could not parse CSV: ' + e.message });
  }

  // Normalise column names to lowercase with underscores
  const rows = [];
  for (const raw of records) {
    const lower = {};
    for (const [k, v] of Object.entries(raw)) {
      lower[k.toLowerCase().replace(/\s+/g, '_')] = v;
    }

    const order_number = (lower.order_number || lower.order || '').replace(/^#/, '').trim();
    const email        = (lower.email || '').trim().toLowerCase();
    const name         = (lower.name || lower.customer_name || '').trim();

    if (!order_number || !email) continue; // skip incomplete rows
    rows.push({ order_number, email, name });
  }

  if (rows.length === 0) {
    return res.status(400).json({ ok: false, error: 'No valid rows found. Make sure columns include email and order_number.' });
  }

  db.upsertOrders(rows);
  res.json({ ok: true, imported: rows.length });
});

// ── GET /admin/orders ────────────────────────────────────────────────────────

router.get('/orders', requireAdmin, (req, res) => {
  res.json(db.getAllOrders());
});

// ── GET /admin/votes ─────────────────────────────────────────────────────────

router.get('/votes', requireAdmin, (req, res) => {
  res.json(db.getAllVotes());
});

// ── GET /admin/votes/export ──────────────────────────────────────────────────

router.get('/votes/export', requireAdmin, (req, res) => {
  const votes = db.getAllVotes();
  const header = 'order_number,voter_name,email,charity_id,charity_name,voted_at\n';
  const rows   = votes.map(v =>
    [v.order_number, v.voter_name, v.email, v.charity_id, v.charity_name, v.voted_at]
      .map(f => `"${(f || '').replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="rf-votes.csv"');
  res.send(header + rows);
});

// ── GET /admin/settings ───────────────────────────────────────────────────────

router.get('/settings', requireAdmin, (req, res) => {
  res.json(db.getAllSettings());
});

// ── POST /admin/settings ──────────────────────────────────────────────────────
// Body: JSON object of key/value pairs to save

router.post('/settings', requireAdmin, express.json(), (req, res) => {
  const pairs = req.body;
  if (!pairs || typeof pairs !== 'object' || Array.isArray(pairs)) {
    return res.status(400).json({ ok: false, error: 'Expected a JSON object.' });
  }
  db.setSetting(pairs);
  res.json({ ok: true });
});

// ── POST /admin/upload-image ──────────────────────────────────────────────────
// Form fields: slot (string identifier), image file

router.post('/upload-image', requireAdmin, (req, res) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No image uploaded.' });

    const slot = (req.body.slot || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!slot) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ ok: false, error: 'No slot specified.' });
    }

    // Rename temp file to slot-based name so each slot gets its own file
    const ext         = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const newFilename = slot + ext;
    const newPath     = path.join(UPLOADS_DIR, newFilename);
    fs.renameSync(req.file.path, newPath);

    const url = '/uploads/' + newFilename;
    db.setSetting({ [slot]: url });
    res.json({ ok: true, url });
  });
});

// ── GET /uploads/:file ────────────────────────────────────────────────────────
// Handled by express.static in index.js (served at /uploads)

module.exports = router;
