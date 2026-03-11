'use strict';

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path    = require('path');

const adminRoutes = require('./routes/admin');
const apiRoutes   = require('./routes/api');
const db = require('./database');

const app  = express();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// ── Initialize SMTP settings from .env if not in database ──────────────────
(function initializeSettings() {
  const currentSettings = db.getAllSettings();
  const envSettings = {
    smtp_host: process.env.SMTP_HOST,
    smtp_port: process.env.SMTP_PORT,
    smtp_user: process.env.SMTP_USER,
    smtp_pass: process.env.SMTP_PASS,
    smtp_from_email: process.env.SMTP_FROM_EMAIL,
    smtp_from_name: process.env.SMTP_FROM_NAME,
    site_url: process.env.SITE_URL,
    smtp_secure: '1',
    shopify_store_domain: process.env.SHOPIFY_STORE_DOMAIN,
    shopify_admin_access_token: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    shopify_client_id: process.env.SHOPIFY_CLIENT_ID,
    shopify_client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    shopify_api_version: process.env.SHOPIFY_API_VERSION,
  };

  const toUpdate = {};
  Object.keys(envSettings).forEach(key => {
    if (envSettings[key] && !currentSettings[key]) {
      toUpdate[key] = envSettings[key];
    }
  });

  if (Object.keys(toUpdate).length > 0) {
    db.setSetting(toUpdate);
    console.log('✓ Initialized SMTP settings from .env');
  }
})();

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow the configured origin AND localhost for local preview
  if (
    origin === ALLOWED_ORIGIN ||
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
    /^file:\/\//.test(origin) ||
    !origin // same-origin or non-browser requests
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Sessions ─────────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   8 * 60 * 60 * 1000, // 8 hours
  },
}));

// ── Static assets ─────────────────────────────────────────────────────────────
app.use('/public',  express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/admin', adminRoutes);
app.use('/api',   apiRoutes);

// Campaign page at root
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Red Funding server running at http://localhost:${PORT}`);
  console.log(`  Admin panel:  http://localhost:${PORT}/admin`);
  console.log(`  API counts:   http://localhost:${PORT}/api/counts\n`);
});
