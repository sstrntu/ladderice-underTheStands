'use strict';

const express = require('express');
const db      = require('../database');
const router  = express.Router();

// ── GET /api/counts ──────────────────────────────────────────────────────────
// Returns current vote tallies. Cached for 60 seconds by the CDN/browser.

router.get('/counts', (req, res) => {
  const votes = db.getVoteCounts();
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ ok: true, votes, total });
});

// ── POST /api/verify ─────────────────────────────────────────────────────────
// Body: { query: "email or order number" }
// Returns: { ok, alreadyVoted, votedFor, orderNumber }

router.post('/verify', express.json(), (req, res) => {
  const raw = (req.body.query || '').trim();
  if (!raw) {
    return res.status(400).json({ ok: false, error: 'empty_query' });
  }

  // Normalise: remove leading #, lowercase
  const query = raw.replace(/^#/, '').toLowerCase();

  const order = db.findOrder(query);
  if (!order) {
    return res.json({ ok: false, error: 'not_found' });
  }

  const existing = db.getExistingVote(order.order_number);
  if (existing) {
    return res.json({
      ok: true,
      alreadyVoted: true,
      votedFor:    existing.charity_id,
      votedForName:existing.charity_name,
    });
  }

  res.json({
    ok:          true,
    alreadyVoted:false,
    orderNumber: order.order_number,
    voterName:   order.name,
  });
});

// ── POST /api/vote ───────────────────────────────────────────────────────────
// Body: { orderNumber, charityId, charityName }
// Returns: { ok, votes, total } or { ok: false, error }

router.post('/vote', express.json(), (req, res) => {
  const { orderNumber, charityId, charityName } = req.body || {};

  if (!orderNumber || !charityId) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  if (!['1', '2', '3'].includes(String(charityId))) {
    return res.status(400).json({ ok: false, error: 'invalid_charity' });
  }

  // Confirm order exists (guard against forged requests)
  const order = db.findOrder(orderNumber.replace(/^#/, '').toLowerCase());
  if (!order) {
    return res.status(400).json({ ok: false, error: 'order_not_found' });
  }

  const result = db.recordVote(order.order_number, String(charityId), charityName || '');
  if (!result.ok) {
    return res.json({ ok: false, error: result.error });
  }

  const votes = db.getVoteCounts();
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  res.json({ ok: true, votes, total });
});

// ── GET /api/validate-token ──────────────────────────────────────────────────
// Query: ?token=xxx
// Returns: { ok, name, alreadyVoted? } or { ok: false, reason }

router.get('/validate-token', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ ok: false, reason: 'missing_token' });
  }

  const tokenRow = db.findToken(token);
  if (!tokenRow) {
    return res.json({ ok: false, reason: 'invalid' });
  }

  if (tokenRow.used) {
    return res.json({ ok: false, reason: 'used' });
  }

  // Check if this email has already voted via this token
  // (the token is used as order_number in votes table)
  const existing = db.getExistingVote(token);
  if (existing) {
    return res.json({
      ok: true,
      name: tokenRow.name,
      alreadyVoted: true,
      votedFor: existing.charity_id,
      votedForName: existing.charity_name,
    });
  }

  res.json({
    ok: true,
    name: tokenRow.name,
    alreadyVoted: false,
  });
});

// ── POST /api/vote-with-token ─────────────────────────────────────────────────
// Body: { token, charityId, charityName }
// Returns: { ok, votes, total } or { ok: false, error }

router.post('/vote-with-token', express.json(), (req, res) => {
  const { token, charityId, charityName } = req.body || {};

  if (!token || !charityId) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  if (!['1', '2', '3'].includes(String(charityId))) {
    return res.status(400).json({ ok: false, error: 'invalid_charity' });
  }

  // Validate token
  const tokenRow = db.findToken(token);
  if (!tokenRow || tokenRow.used) {
    return res.json({ ok: false, error: 'invalid_token' });
  }

  // Ensure an order record exists for this token (use token as order_number)
  const existingOrder = db.findOrder(token);
  if (!existingOrder) {
    db.upsertOrders([{
      order_number: token,
      email: tokenRow.email,
      name: tokenRow.name,
    }]);
  }

  // Record the vote
  const result = db.recordVote(token, String(charityId), charityName || '');
  if (!result.ok) {
    return res.json({ ok: false, error: result.error });
  }

  // Mark token as used
  db.markTokenUsed(token);

  const votes = db.getVoteCounts();
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  res.json({ ok: true, votes, total });
});

// ── GET /api/settings ────────────────────────────────────────────────────────
// Returns public CMS settings (text content, image paths)

router.get('/settings', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json(db.getAllSettings());
});

module.exports = router;
