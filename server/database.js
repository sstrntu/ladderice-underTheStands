'use strict';

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'votes.db');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT    UNIQUE NOT NULL,
    email        TEXT    NOT NULL,
    name         TEXT    DEFAULT '',
    uploaded_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS vote_tokens (
    token       TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    name        TEXT DEFAULT '',
    used        INTEGER DEFAULT 0,
    email_sent  INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at     DATETIME
  );
`);

ensureVoteSchema();
ensureVoteTokenSchema();

function ensureVoteSchema() {
  const hasVotesTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'votes'
  `).get();

  if (!hasVotesTable) {
    db.exec(`
      CREATE TABLE votes (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT    NOT NULL,
        token        TEXT,
        charity_id   TEXT    NOT NULL,
        charity_name TEXT    DEFAULT '',
        vote_index   INTEGER DEFAULT 1,
        voted_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_number) REFERENCES orders(order_number),
        FOREIGN KEY (token) REFERENCES vote_tokens(token)
      );
    `);
  } else {
    const voteColumns = db.prepare(`PRAGMA table_info(votes)`).all().map(row => row.name);
    if (!voteColumns.includes('token')) {
      db.exec(`
        ALTER TABLE votes RENAME TO votes_legacy;

        CREATE TABLE votes (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          order_number TEXT    NOT NULL,
          token        TEXT,
          charity_id   TEXT    NOT NULL,
          charity_name TEXT    DEFAULT '',
          vote_index   INTEGER DEFAULT 1,
          voted_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_number) REFERENCES orders(order_number),
          FOREIGN KEY (token) REFERENCES vote_tokens(token)
        );

        INSERT INTO votes (id, order_number, token, charity_id, charity_name, vote_index, voted_at)
        SELECT id, order_number, NULL, charity_id, charity_name, 1, voted_at
        FROM votes_legacy;

        DROP TABLE votes_legacy;
      `);
    }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_votes_order_number ON votes(order_number);
    CREATE INDEX IF NOT EXISTS idx_votes_token ON votes(token);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_token_vote_index
      ON votes(token, vote_index)
      WHERE token IS NOT NULL;
  `);
}

function ensureVoteTokenSchema() {
  const columns = db.prepare(`PRAGMA table_info(vote_tokens)`).all().map(row => row.name);
  const additions = [
    ['source', "TEXT DEFAULT 'manual'"],
    ['shopify_order_id', 'TEXT'],
    ['shopify_order_name', 'TEXT DEFAULT \'\''],
    ['votes_total', 'INTEGER DEFAULT 1'],
    ['votes_used', 'INTEGER DEFAULT 0'],
    ['last_validated_at', 'DATETIME'],
  ];

  additions.forEach(([name, spec]) => {
    if (!columns.includes(name)) {
      db.exec(`ALTER TABLE vote_tokens ADD COLUMN ${name} ${spec}`);
    }
  });

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vote_tokens_shopify_order_id
      ON vote_tokens(shopify_order_id)
      WHERE shopify_order_id IS NOT NULL;
  `);

  db.exec(`
    UPDATE vote_tokens
    SET votes_total = CASE WHEN votes_total IS NULL OR votes_total < 1 THEN 1 ELSE votes_total END,
        votes_used = CASE
          WHEN votes_used IS NULL THEN CASE WHEN used = 1 THEN 1 ELSE 0 END
          ELSE votes_used
        END,
        source = COALESCE(source, 'manual'),
        shopify_order_name = COALESCE(shopify_order_name, '')
  `);

  syncTokenUsage();
}

function normalizeOrderNumber(value) {
  return String(value || '').trim().replace(/^#/, '').toLowerCase();
}

function getVoteCountForOrder(orderNumber) {
  return db.prepare(`SELECT COUNT(*) AS c FROM votes WHERE order_number = ?`).get(orderNumber).c;
}

function getVoteCountForToken(token) {
  return db.prepare(`SELECT COUNT(*) AS c FROM votes WHERE token = ?`).get(token).c;
}

function syncTokenUsage(token) {
  const sql = token
    ? `
      UPDATE vote_tokens
      SET votes_used = (SELECT COUNT(*) FROM votes WHERE votes.token = vote_tokens.token),
          used = CASE
            WHEN votes_total <= (SELECT COUNT(*) FROM votes WHERE votes.token = vote_tokens.token) THEN 1
            ELSE 0
          END,
          used_at = CASE
            WHEN votes_total <= (SELECT COUNT(*) FROM votes WHERE votes.token = vote_tokens.token)
              AND (SELECT COUNT(*) FROM votes WHERE votes.token = vote_tokens.token) > 0
            THEN COALESCE(used_at, CURRENT_TIMESTAMP)
            ELSE used_at
          END
      WHERE token = ?
    `
    : `
      UPDATE vote_tokens
      SET votes_used = (SELECT COUNT(*) FROM votes WHERE votes.token = vote_tokens.token),
          used = CASE
            WHEN votes_total <= (SELECT COUNT(*) FROM votes WHERE votes.token = vote_tokens.token) THEN 1
            ELSE 0
          END,
          used_at = CASE
            WHEN votes_total <= (SELECT COUNT(*) FROM votes WHERE votes.token = vote_tokens.token)
              AND (SELECT COUNT(*) FROM votes WHERE votes.token = vote_tokens.token) > 0
            THEN COALESCE(used_at, CURRENT_TIMESTAMP)
            ELSE used_at
          END
    `;

  if (token) db.prepare(sql).run(token);
  else db.prepare(sql).run();
}

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

function findOrder(query) {
  const normalized = normalizeOrderNumber(query);
  return db.prepare(`
    SELECT * FROM orders
    WHERE LOWER(email) = LOWER(?) OR LOWER(order_number) = LOWER(?)
    LIMIT 1
  `).get(query, normalized);
}

function getAllOrders() {
  return db.prepare(`SELECT * FROM orders ORDER BY uploaded_at DESC`).all();
}

function recordVote(orderNumber, charityId, charityName) {
  const normalized = normalizeOrderNumber(orderNumber);
  if (!normalized || !charityId) {
    return { ok: false, error: 'missing_fields' };
  }
  if (getVoteCountForOrder(normalized) > 0) {
    return { ok: false, error: 'already_voted' };
  }

  db.prepare(`
    INSERT INTO votes (order_number, charity_id, charity_name, vote_index)
    VALUES (?, ?, ?, 1)
  `).run(normalized, String(charityId), charityName || '');

  return { ok: true, votesUsed: 1, votesRemaining: 0, votesTotal: 1 };
}

function getExistingVote(orderNumber) {
  const normalized = normalizeOrderNumber(orderNumber);
  return db.prepare(`
    SELECT charity_id, charity_name FROM votes
    WHERE order_number = ?
    ORDER BY voted_at ASC, id ASC
    LIMIT 1
  `).get(normalized) || null;
}

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
    SELECT
      v.*,
      COALESCE(o.name, t.name) AS voter_name,
      COALESCE(o.email, t.email) AS email
    FROM votes v
    LEFT JOIN orders o ON v.order_number = o.order_number
    LEFT JOIN vote_tokens t ON v.token = t.token
    ORDER BY v.voted_at DESC, v.id DESC
  `).all();
}

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

function createToken(email, name = '', options = {}) {
  const source = options.source || 'manual';
  const votesTotal = Math.max(1, parseInt(options.votesTotal || '1', 10) || 1);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const shopifyOrderId = options.shopifyOrderId ? String(options.shopifyOrderId).trim() : null;
  const shopifyOrderName = String(options.shopifyOrderName || '').trim();

  if (!normalizedEmail) return null;

  if (shopifyOrderId) {
    const existing = findTokenByShopifyOrderId(shopifyOrderId);
    if (existing) return existing.token;
  } else if (source === 'manual') {
    const existingManual = findTokenByEmail(normalizedEmail);
    if (existingManual && existingManual.source === 'manual') return existingManual.token;
  }

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`
    INSERT INTO vote_tokens (
      token, email, name, source, shopify_order_id, shopify_order_name,
      votes_total, votes_used, used, email_sent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `).run(
    token,
    normalizedEmail,
    name || '',
    source,
    shopifyOrderId,
    shopifyOrderName,
    votesTotal,
    options.emailSent ? 1 : 0
  );

  return token;
}

function findToken(token) {
  if (!token) return null;
  syncTokenUsage(token);
  return db.prepare(`SELECT * FROM vote_tokens WHERE token = ?`).get(token) || null;
}

function findTokenByShopifyOrderId(shopifyOrderId) {
  if (!shopifyOrderId) return null;
  syncTokenUsage();
  return db.prepare(`
    SELECT * FROM vote_tokens WHERE shopify_order_id = ?
  `).get(String(shopifyOrderId)) || null;
}

function findTokenByEmail(email) {
  if (!email) return null;
  syncTokenUsage();
  return db.prepare(`
    SELECT * FROM vote_tokens
    WHERE LOWER(email) = LOWER(?)
    ORDER BY created_at DESC
    LIMIT 1
  `).get(String(email).trim()) || null;
}

function touchTokenValidated(token) {
  db.prepare(`
    UPDATE vote_tokens SET last_validated_at = CURRENT_TIMESTAMP WHERE token = ?
  `).run(token);
}

function markTokenUsed(token) {
  db.prepare(`
    UPDATE vote_tokens
    SET used = 1, votes_used = votes_total, used_at = CURRENT_TIMESTAMP
    WHERE token = ?
  `).run(token);
}

function markEmailSent(tokens) {
  if (!Array.isArray(tokens)) tokens = [tokens];
  const stmt = db.prepare(`UPDATE vote_tokens SET email_sent = 1 WHERE token = ?`);
  for (const token of tokens) stmt.run(token);
}

function recordTokenVote(token, charityId, charityName) {
  const row = findToken(token);
  if (!row) return { ok: false, error: 'invalid_token' };

  const votesUsed = getVoteCountForToken(token);
  if (votesUsed >= row.votes_total) {
    syncTokenUsage(token);
    return { ok: false, error: 'already_voted' };
  }

  const orderNumber = normalizeOrderNumber(row.shopify_order_name || token);
  const voteIndex = votesUsed + 1;

  upsertOrders([{
    order_number: orderNumber,
    email: row.email,
    name: row.name || '',
  }]);

  try {
    db.prepare(`
      INSERT INTO votes (order_number, token, charity_id, charity_name, vote_index)
      VALUES (?, ?, ?, ?, ?)
    `).run(orderNumber, token, String(charityId), charityName || '', voteIndex);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      syncTokenUsage(token);
      return { ok: false, error: 'already_voted' };
    }
    throw e;
  }

  syncTokenUsage(token);
  const updated = findToken(token);
  const nextVotesUsed = updated ? updated.votes_used : voteIndex;
  const votesRemaining = updated ? Math.max(updated.votes_total - updated.votes_used, 0) : 0;
  return {
    ok: true,
    votesUsed: nextVotesUsed,
    votesRemaining,
    votesTotal: updated ? updated.votes_total : voteIndex,
    exhausted: votesRemaining === 0,
  };
}

function getAllTokens() {
  syncTokenUsage();
  return db.prepare(`
    SELECT
      token,
      email,
      name,
      used,
      email_sent,
      created_at,
      used_at,
      source,
      shopify_order_id,
      shopify_order_name,
      votes_total,
      votes_used,
      last_validated_at
    FROM vote_tokens
    ORDER BY created_at DESC
  `).all();
}

function getTokenStats() {
  syncTokenUsage();
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS token_count,
      SUM(CASE WHEN email_sent = 1 THEN 1 ELSE 0 END) AS sent_count,
      SUM(votes_used) AS votes_cast,
      SUM(votes_total) AS vote_capacity
    FROM vote_tokens
  `).get();

  return {
    total: totals.token_count || 0,
    sent: totals.sent_count || 0,
    used: totals.votes_cast || 0,
    capacity: totals.vote_capacity || 0,
  };
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
  findTokenByShopifyOrderId,
  findTokenByEmail,
  touchTokenValidated,
  markTokenUsed,
  markEmailSent,
  recordTokenVote,
  getAllTokens,
  getTokenStats,
  normalizeOrderNumber,
};
