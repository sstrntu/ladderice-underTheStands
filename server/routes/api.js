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

// ── GET /api/settings ────────────────────────────────────────────────────────
// Returns public CMS settings (text content, image paths)

router.get('/settings', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json(db.getAllSettings());
});

module.exports = router;
