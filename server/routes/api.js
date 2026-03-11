'use strict';

const express = require('express');
const db = require('../database');
const shopify = require('../shopify');

const router = express.Router();

function getEligibleShopifyProductIds() {
  const settings = db.getAllSettings();
  const ids = new Set();
  for (let i = 1; i <= 6; i++) {
    const raw = String(settings['product_' + i + '_shopify_product_id'] || '').trim();
    if (raw) ids.add(raw);
  }
  return ids;
}

function getOrderCustomerEmail(order) {
  return String(
    order && (order.email || (order.customer && order.customer.email) || '')
  ).trim().toLowerCase();
}

function getOrderCustomerName(order) {
  if (!order || !order.customer) return '';
  const parts = [order.customer.first_name, order.customer.last_name].filter(Boolean);
  return parts.join(' ').trim();
}

function redirectToVoteError(res, code) {
  res.redirect('/?vote_error=' + encodeURIComponent(code));
}

router.get('/counts', (req, res) => {
  const votes = db.getVoteCounts();
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ ok: true, votes, total });
});

router.post('/verify', express.json(), (req, res) => {
  const raw = (req.body.query || '').trim();
  if (!raw) {
    return res.status(400).json({ ok: false, error: 'empty_query' });
  }

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
      votedFor: existing.charity_id,
      votedForName: existing.charity_name,
      votesTotal: 1,
      votesUsed: 1,
      votesRemaining: 0,
    });
  }

  res.json({
    ok: true,
    alreadyVoted: false,
    orderNumber: order.order_number,
    voterName: order.name,
    votesTotal: 1,
    votesUsed: 0,
    votesRemaining: 1,
  });
});

router.get('/vote/start', async (req, res) => {
  const orderId = String(req.query.order_id || '').trim();
  const email = String(req.query.email || '').trim().toLowerCase();

  if (!orderId || !email) {
    return redirectToVoteError(res, 'missing_order');
  }

  let order;
  try {
    order = await shopify.getOrder(orderId);
  } catch (error) {
    console.error('Shopify order lookup failed:', error);
    return redirectToVoteError(res, 'shopify_unavailable');
  }

  if (!order) return redirectToVoteError(res, 'order_not_found');
  if (String(order.financial_status || '').toLowerCase() !== 'paid') {
    return redirectToVoteError(res, 'order_unpaid');
  }

  const orderEmail = getOrderCustomerEmail(order);
  if (!orderEmail || orderEmail !== email) {
    return redirectToVoteError(res, 'email_mismatch');
  }

  const eligibleProductIds = getEligibleShopifyProductIds();
  if (eligibleProductIds.size === 0) {
    return redirectToVoteError(res, 'not_configured');
  }

  const votesTotal = (order.line_items || []).reduce((count, item) => {
    const productId = item && item.product_id != null ? String(item.product_id) : '';
    if (!eligibleProductIds.has(productId)) return count;
    return count + Math.max(parseInt(item.quantity || '0', 10) || 0, 0);
  }, 0);

  if (votesTotal <= 0) {
    return redirectToVoteError(res, 'not_eligible');
  }

  const orderNumber = db.normalizeOrderNumber(order.name || order.id);
  db.upsertOrders([{
    order_number: orderNumber,
    email: orderEmail,
    name: getOrderCustomerName(order),
  }]);

  const token = db.createToken(orderEmail, getOrderCustomerName(order), {
    source: 'shopify',
    shopifyOrderId: String(order.id),
    shopifyOrderName: String(order.name || order.id),
    votesTotal,
    emailSent: true,
  });

  if (!token) {
    return redirectToVoteError(res, 'token_failed');
  }

  res.redirect('/?token=' + encodeURIComponent(token));
});

router.post('/vote', express.json(), (req, res) => {
  const { orderNumber, charityId, charityName } = req.body || {};

  if (!orderNumber || !charityId) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  if (!['1', '2', '3'].includes(String(charityId))) {
    return res.status(400).json({ ok: false, error: 'invalid_charity' });
  }

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
  res.json({
    ok: true,
    votes,
    total,
    votesTotal: result.votesTotal,
    votesUsed: result.votesUsed,
    votesRemaining: result.votesRemaining,
  });
});

router.get('/validate-token', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ ok: false, reason: 'missing_token' });
  }

  const tokenRow = db.findToken(token);
  if (!tokenRow) {
    return res.json({ ok: false, reason: 'invalid' });
  }

  db.touchTokenValidated(token);

  const votesRemaining = Math.max((tokenRow.votes_total || 1) - (tokenRow.votes_used || 0), 0);
  const firstVote = tokenRow.shopify_order_name
    ? db.getExistingVote(db.normalizeOrderNumber(tokenRow.shopify_order_name))
    : db.getExistingVote(token);

  res.json({
    ok: true,
    name: tokenRow.name,
    alreadyVoted: votesRemaining === 0 && (tokenRow.votes_used || 0) > 0,
    votedFor: firstVote ? firstVote.charity_id : null,
    votedForName: firstVote ? firstVote.charity_name : '',
    votesTotal: tokenRow.votes_total || 1,
    votesUsed: tokenRow.votes_used || 0,
    votesRemaining,
  });
});

router.post('/vote-with-token', express.json(), (req, res) => {
  const { token, charityId, charityName } = req.body || {};

  if (!token || !charityId) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  if (!['1', '2', '3'].includes(String(charityId))) {
    return res.status(400).json({ ok: false, error: 'invalid_charity' });
  }

  const result = db.recordTokenVote(token, String(charityId), charityName || '');
  if (!result.ok) {
    return res.json({ ok: false, error: result.error });
  }

  const votes = db.getVoteCounts();
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  res.json({
    ok: true,
    votes,
    total,
    votesTotal: result.votesTotal,
    votesUsed: result.votesUsed,
    votesRemaining: result.votesRemaining,
    exhausted: result.exhausted,
  });
});

router.get('/settings', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json(db.getAllSettings());
});

module.exports = router;
