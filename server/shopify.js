'use strict';

const db = require('./database');

const DEFAULT_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
let cachedToken = null;
let cachedTokenExpiry = 0;

function normalizeShopDomain(input) {
  return String(input || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

function getConfig() {
  const settings = db.getAllSettings();
  const shopDomain = normalizeShopDomain(process.env.SHOPIFY_STORE_DOMAIN || settings.shopify_store_domain);
  const accessToken = String(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || settings.shopify_admin_access_token || '').trim();
  const clientId = String(process.env.SHOPIFY_CLIENT_ID || settings.shopify_client_id || '').trim();
  const clientSecret = String(process.env.SHOPIFY_CLIENT_SECRET || settings.shopify_client_secret || '').trim();
  const apiVersion = String(process.env.SHOPIFY_API_VERSION || settings.shopify_api_version || DEFAULT_API_VERSION).trim() || DEFAULT_API_VERSION;

  return { shopDomain, accessToken, clientId, clientSecret, apiVersion };
}

async function getAccessToken(config) {
  if (config.accessToken) return config.accessToken;
  if (!config.clientId || !config.clientSecret) {
    throw new Error('Shopify client credentials are not configured.');
  }
  const now = Date.now();
  if (cachedToken && cachedTokenExpiry > now + 30 * 1000) {
    return cachedToken;
  }

  const response = await fetch(`https://${config.shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shopify token exchange failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const payload = await response.json();
  cachedToken = payload.access_token || '';
  cachedTokenExpiry = now + ((payload.expires_in || 0) * 1000);
  if (!cachedToken) {
    throw new Error('Shopify token exchange returned no access token.');
  }
  return cachedToken;
}

async function requestAdmin(pathname) {
  const config = getConfig();
  if (!config.shopDomain) {
    throw new Error('Shopify store domain is not configured.');
  }
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available in this Node runtime.');
  }

  const accessToken = await getAccessToken(config);
  const url = `https://${config.shopDomain}/admin/api/${config.apiVersion}${pathname}`;
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shopify request failed (${response.status}): ${body.slice(0, 240)}`);
  }

  return response.json();
}

async function getOrder(orderId) {
  const safeId = encodeURIComponent(String(orderId || '').trim());
  const json = await requestAdmin(`/orders/${safeId}.json?status=any&fields=id,name,email,financial_status,line_items,customer`);
  return json.order || null;
}

async function getShopInfo() {
  const json = await requestAdmin('/shop.json?fields=name,myshopify_domain,primary_domain,plan_name');
  return json.shop || null;
}

module.exports = {
  getConfig,
  getOrder,
  getShopInfo,
  normalizeShopDomain,
};
