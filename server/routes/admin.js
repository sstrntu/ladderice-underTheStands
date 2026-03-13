'use strict';

const express  = require('express');
const multer   = require('multer');
const { parse } = require('csv-parse/sync');
const path     = require('path');
const fs       = require('fs');
const db       = require('../database');
const mailer   = require('../mailer');
const { requireAdmin } = require('../middleware/auth');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const SMTP_PRESET_FIELDS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name', 'site_url', 'smtp_secure'];

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

router.post('/login', express.json(), express.urlencoded({ extended: false }), (req, res) => {
  const { username, password } = req.body;
  const isJson = req.headers['content-type'] && req.headers['content-type'].includes('application/json');
  if (
    username === 'admin' &&
    password === 'bss@5432'
  ) {
    req.session.admin = true;
    if (isJson) return res.json({ ok: true, redirect: '/admin/dashboard' });
    return res.redirect('/admin/dashboard');
  }
  if (isJson) return res.status(401).json({ ok: false, error: 'Incorrect username or password.' });
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

router.get('/smtp-presets', requireAdmin, (req, res) => {
  const settings = db.getAllSettings();
  const presets = {};

  Object.keys(settings).forEach((key) => {
    const match = key.match(/^smtp_preset_([^_]+)_(.+)$/);
    if (!match) return;
    const name = match[1];
    const field = match[2];
    presets[name] = presets[name] || {};
    presets[name][field] = settings[key];
  });

  res.json({ presets });
});

router.post('/smtp-presets/save', requireAdmin, express.json(), (req, res) => {
  const name = String((req.body && req.body.name) || '').trim().toLowerCase();
  const values = req.body && req.body.values;

  if (!name || !/^[a-z0-9_-]+$/.test(name)) {
    return res.status(400).json({ ok: false, error: 'Preset name must use letters, numbers, hyphens, or underscores.' });
  }
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return res.status(400).json({ ok: false, error: 'Preset values are required.' });
  }

  const pairs = {};
  SMTP_PRESET_FIELDS.forEach((field) => {
    pairs[`smtp_preset_${name}_${field}`] = values[field] || '';
  });
  db.setSetting(pairs);
  res.json({ ok: true });
});

router.post('/smtp-presets/apply', requireAdmin, express.json(), (req, res) => {
  const name = String((req.body && req.body.name) || '').trim().toLowerCase();
  if (!name) return res.status(400).json({ ok: false, error: 'Preset name is required.' });

  const settings = db.getAllSettings();
  const pairs = {};
  SMTP_PRESET_FIELDS.forEach((field) => {
    const key = `smtp_preset_${name}_${field}`;
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      pairs[field] = settings[key];
    }
  });

  if (Object.keys(pairs).length === 0) {
    return res.status(404).json({ ok: false, error: 'Preset not found.' });
  }

  db.setSetting(pairs);
  res.json({ ok: true, applied: pairs });
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

// ── POST /admin/upload-voters ─────────────────────────────────────────────────
// Upload CSV of customer emails for vote campaign.
// Columns: email, name (can also be first_name/last_name or customer_name)

router.post('/upload-voters', requireAdmin, upload.single('csv'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file uploaded.' });
  }

  let records;
  try {
    records = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Could not parse CSV: ' + e.message });
  }

  // Normalise column names
  const rows = [];
  for (const raw of records) {
    const lower = {};
    for (const [k, v] of Object.entries(raw)) {
      lower[k.toLowerCase().replace(/\s+/g, '_')] = v;
    }

    const email = (lower.email || '').trim().toLowerCase();
    const name  = (lower.name || lower.first_name || lower.customer_name || '').trim();

    if (!email) continue; // skip rows without email

    // Check if email already has a token
    const existing = db.findOrder(email); // use findOrder as a workaround to check if exists
    if (!existing) { // only create if not existing
      rows.push({ email, name });
    }
  }

  let created = 0;
  let skipped = rows.length > 0 ? records.length - rows.length : records.length;

  for (const { email, name } of rows) {
    db.createToken(email, name);
    created++;
  }

  res.json({ ok: true, created, skipped });
});

// ── GET /admin/tokens ─────────────────────────────────────────────────────────
// Return all vote tokens (for admin table)

router.get('/tokens', requireAdmin, (req, res) => {
  res.json(db.getAllTokens());
});

// ── GET /admin/token-stats ────────────────────────────────────────────────────
// Return token statistics: { total, sent, used }

router.get('/token-stats', requireAdmin, (req, res) => {
  res.json(db.getTokenStats());
});

// ── POST /admin/send-vote-emails ──────────────────────────────────────────────
// Send vote invitation emails to all tokens where email_sent=0

router.post('/send-vote-emails', requireAdmin, express.json(), async (req, res) => {
  try {
    const tokens = db.getAllTokens();
    const toSend = tokens.filter(t => !t.email_sent);

    if (toSend.length === 0) {
      return res.json({ ok: true, sent: 0, failed: 0, message: 'No unsent emails' });
    }

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const token of toSend) {
      const result = await mailer.sendVoteEmail(token.token, token.email, token.name);
      if (result.ok) {
        db.markEmailSent(token.token);
        sent++;
      } else {
        failed++;
        errors.push({ email: token.email, error: result.error });
      }
    }

    res.json({ ok: true, sent, failed, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error('Send emails error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ── POST /admin/resend-email ──────────────────────────────────────────────────
// Resend vote email for a specific token
// Body: { token }

router.post('/resend-email', requireAdmin, express.json(), async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ ok: false, error: 'No token provided.' });
  }

  const tokenRow = db.findToken(token);
  if (!tokenRow) {
    return res.status(400).json({ ok: false, error: 'Token not found.' });
  }

  try {
    const result = await mailer.sendVoteEmail(token, tokenRow.email, tokenRow.name);
    if (result.ok) {
      db.markEmailSent(token);
      res.json({ ok: true, message: 'Email sent.' });
    } else {
      res.json({ ok: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ── POST /admin/manual-token ──────────────────────────────────────────────────
// Manually create a single token for a customer not in the CSV
// Body: { email, name }

router.post('/manual-token', requireAdmin, express.json(), (req, res) => {
  const { email, name } = req.body || {};
  if (!email) {
    return res.status(400).json({ ok: false, error: 'Email is required.' });
  }

  const token = db.createToken(email, name || '');
  if (!token) {
    return res.status(400).json({ ok: false, error: 'Could not create token (email may already exist).' });
  }

  res.json({ ok: true, token, email });
});

// ── DELETE /admin/votes/:id ───────────────────────────────────────────────────

router.delete('/votes/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'Invalid vote id.' });
  db.deleteVote(id);
  res.json({ ok: true });
});

// ── POST /admin/votes/delete-all ──────────────────────────────────────────────

router.post('/votes/delete-all', requireAdmin, (req, res) => {
  db.deleteAllVotes();
  res.json({ ok: true });
});

// ── DELETE /admin/tokens/:token ───────────────────────────────────────────────

router.delete('/tokens/:token', requireAdmin, (req, res) => {
  const token = req.params.token;
  if (!token) return res.status(400).json({ ok: false, error: 'Token required.' });
  db.deleteToken(token);
  res.json({ ok: true });
});

// ── POST /admin/tokens/delete-all ─────────────────────────────────────────────

router.post('/tokens/delete-all', requireAdmin, (req, res) => {
  db.deleteAllTokens();
  res.json({ ok: true });
});

// ── POST /admin/send-test-email ────────────────────────────────────────────
// Send a test email to verify SMTP settings
// Body: { email }

router.post('/send-test-email', requireAdmin, express.json(), async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ ok: false, error: 'Email address required.' });
  }

  try {
    const settings = db.getAllSettings();
    const result = await mailer.sendVoteEmail('TEST-' + Date.now(), email, 'Test Recipient');
    if (result.ok) {
      res.json({ ok: true, message: 'Test email sent successfully.' });
    } else {
      res.json({ ok: false, error: result.error });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
