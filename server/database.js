'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'votes.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT    UNIQUE NOT NULL,
    email        TEXT    NOT NULL,
    name         TEXT    DEFAULT '',
    uploaded_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS votes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT    UNIQUE NOT NULL,
    charity_id   TEXT    NOT NULL,
    charity_name TEXT    DEFAULT '',
    voted_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_number) REFERENCES orders(order_number)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS vote_tokens (
    token       TEXT UNIQUE NOT NULL,
    email       TEXT NOT NULL,
    name        TEXT DEFAULT '',
    used        INTEGER DEFAULT 0,
    email_sent  INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at     DATETIME
  );
`);

// ── Order helpers ────────────────────────────────────────────────────────────

/**
 * Upsert a batch of orders from a CSV upload.
 * Existing order_numbers are updated; new ones are inserted.
 */
const upsertOrders = db.transaction((rows) => {
  const stmt = db.prepare(`
    INSERT INTO orders (order_number, email, name)
    VALUES (@order_number, @email, @name)
    ON CONFLICT(order_number) DO UPDATE SET
      email = excluded.email,
      name  = excluded.name,
      uploaded_at = CURRENT_TIMESTAMP
  `);
  for (const row of rows) stmt.run(row);
});

/**
 * Find a single order by email OR order number.
 * Input is already normalised (lowercase, no #).
 */
function findOrder(query) {
  return db.prepare(`
    SELECT * FROM orders
    WHERE LOWER(email) = LOWER(?) OR LOWER(order_number) = LOWER(?)
    LIMIT 1
  `).get(query, query);
}

function getAllOrders() {
  return db.prepare(`SELECT * FROM orders ORDER BY uploaded_at DESC`).all();
}

// ── Vote helpers ─────────────────────────────────────────────────────────────

/**
 * Record a vote. Returns { ok, error } — error is 'already_voted' if
 * the UNIQUE constraint fires.
 */
function recordVote(orderNumber, charityId, charityName) {
  try {
    db.prepare(`
      INSERT INTO votes (order_number, charity_id, charity_name)
      VALUES (?, ?, ?)
    `).run(orderNumber, charityId, charityName);
    return { ok: true };
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, error: 'already_voted' };
    }
    throw e;
  }
}

/** Returns { charityId } if this order has already voted, or null. */
function getExistingVote(orderNumber) {
  return db.prepare(`SELECT charity_id, charity_name FROM votes WHERE order_number = ?`)
    .get(orderNumber) || null;
}

/** Returns vote counts keyed by charity_id, e.g. { "1": 12, "2": 5, "3": 20 } */
function getVoteCounts() {
  const rows = db.prepare(`
    SELECT charity_id, COUNT(*) as count FROM votes GROUP BY charity_id
  `).all();
  const counts = { '1': 0, '2': 0, '3': 0 };
  for (const row of rows) counts[row.charity_id] = row.count;
  return counts;
}

function getAllVotes() {
  return db.prepare(`
    SELECT v.*, o.name as voter_name, o.email
    FROM votes v
    JOIN orders o ON v.order_number = o.order_number
    ORDER BY v.voted_at DESC
  `).all();
}

// ── Settings helpers ──────────────────────────────────────────────────────────

function getAllSettings() {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  const obj = {};
  for (const row of rows) obj[row.key] = row.value;
  return obj;
}

const setSetting = db.transaction((pairs) => {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  for (const [key, value] of Object.entries(pairs)) {
    stmt.run(key, String(value));
  }
});

// ── Vote Token helpers (magic links) ──────────────────────────────────────

/**
 * Create a new vote token. Returns the token string.
 * Token is crypto-random, email/name are from CSV upload.
 */
function createToken(email, name = '') {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  try {
    db.prepare(`
      INSERT INTO vote_tokens (token, email, name)
      VALUES (?, ?, ?)
    `).run(token, email, name);
    return token;
  } catch (e) {
    // If email already has a token, return the existing one (idempotent)
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const existing = db.prepare(`SELECT token FROM vote_tokens WHERE email = ?`).get(email);
      return existing ? existing.token : null;
    }
    throw e;
  }
}

/**
 * Find a token by its string. Returns full row or null.
 */
function findToken(token) {
  return db.prepare(`SELECT * FROM vote_tokens WHERE token = ?`).get(token) || null;
}

/**
 * Mark a token as used. Sets used=1 and used_at=NOW().
 */
function markTokenUsed(token) {
  db.prepare(`
    UPDATE vote_tokens SET used = 1, used_at = CURRENT_TIMESTAMP WHERE token = ?
  `).run(token);
}

/**
 * Mark token(s) as email_sent. Can pass single token or array of tokens.
 */
function markEmailSent(tokens) {
  if (!Array.isArray(tokens)) tokens = [tokens];
  const stmt = db.prepare(`UPDATE vote_tokens SET email_sent = 1 WHERE token = ?`);
  for (const token of tokens) stmt.run(token);
}

/**
 * Get all vote tokens (for admin table).
 */
function getAllTokens() {
  return db.prepare(`
    SELECT token, email, name, used, email_sent, created_at, used_at
    FROM vote_tokens ORDER BY created_at DESC
  `).all();
}

/**
 * Get summary stats: { total, sent, used }
 */
function getTokenStats() {
  const total = db.prepare(`SELECT COUNT(*) as c FROM vote_tokens`).get().c;
  const sent = db.prepare(`SELECT COUNT(*) as c FROM vote_tokens WHERE email_sent = 1`).get().c;
  const used = db.prepare(`SELECT COUNT(*) as c FROM vote_tokens WHERE used = 1`).get().c;
  return { total, sent, used };
}

module.exports = {
  upsertOrders,
  findOrder,
  getAllOrders,
  recordVote,
  getExistingVote,
  getVoteCounts,
  getAllVotes,
  getAllSettings,
  setSetting,
  createToken,
  findToken,
  markTokenUsed,
  markEmailSent,
  getAllTokens,
  getTokenStats,
};
