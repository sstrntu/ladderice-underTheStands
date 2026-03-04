'use strict';

const nodemailer = require('nodemailer');
const db = require('./database');

/**
 * Send a vote invitation email via SMTP.
 * Reads SMTP config from DB settings at send time.
 * Returns { ok: true } or { ok: false, error: string }
 */
async function sendVoteEmail(token, email, name) {
  try {
    const settings = db.getAllSettings();

    // Validate required SMTP settings
    const required = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'site_url'];
    for (const key of required) {
      if (!settings[key]) {
        return { ok: false, error: `Missing SMTP setting: ${key}` };
      }
    }

    // Create transporter
    // Port 465 = implicit TLS (secure: true)
    // Port 587 = STARTTLS (secure: false, but upgrades after connect)
    const port = parseInt(settings.smtp_port);
    const secure = port === 465; // only explicit TLS for 465, STARTTLS for 587
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: port,
      secure: secure,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
    });

    // Build vote link (ensure no double slashes)
    const siteUrl = (settings.site_url || '').replace(/\/$/, ''); // remove trailing slash if present
    const voteUrl = `${siteUrl}/?token=${token}`;
    const fromName = settings.smtp_from_name || 'Ladderice Campaign';
    const fromEmail = settings.smtp_from_email;

    // HTML email template
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 28px; margin: 0 0 8px; font-weight: 600; color: #181818; }
    .content { background: #fafaf8; padding: 32px; border-radius: 8px; margin-bottom: 24px; }
    .cta { text-align: center; margin: 32px 0; }
    .cta-btn {
      display: inline-block;
      padding: 12px 32px;
      background: #C41E1E;
      color: white;
      text-decoration: none;
      border-radius: 50px;
      font-weight: 600;
      letter-spacing: 0.05em;
      font-size: 14px;
    }
    .cta-btn:hover { background: #9A1818; }
    .footer { text-align: center; font-size: 12px; color: #999; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Vote is Ready</h1>
      <p style="color: #999; margin: 0;">Ladderice Campaign</p>
    </div>

    <div class="content">
      <p>Hi ${escapeHtml(name || 'there')},</p>
      <p>Thank you for supporting the Ladderice campaign! You've been selected to vote on where our campaign profit goes.</p>
      <p>You can cast your vote by clicking the button below. Choose from three causes that matter to you.</p>

      <div class="cta">
        <a href="${escapeHtml(voteUrl)}" class="cta-btn">Cast Your Vote</a>
      </div>

      <p style="color: #666; font-size: 13px;">Or copy this link: <code>${escapeHtml(voteUrl)}</code></p>
    </div>

    <div class="footer">
      <p>&copy; 2026 Ladderice. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Text fallback
    const textBody = `Your Vote is Ready

Hi ${name || 'there'},

Thank you for supporting the Ladderice campaign! You've been selected to vote on where our campaign profit goes.

Click here to vote:
${voteUrl}

© 2026 Ladderice. All rights reserved.
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: 'Your vote is ready — Ladderice Campaign',
      text: textBody,
      html: htmlBody,
    });

    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Simple HTML escape helper
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (ch) => map[ch]);
}

module.exports = { sendVoteEmail };
