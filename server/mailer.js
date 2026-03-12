'use strict';

const nodemailer = require('nodemailer');
const db = require('./database');

/**
 * Send a vote invitation email via SMTP.
 * Reads SMTP config + email content from DB settings at send time.
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
    const port = parseInt(settings.smtp_port);
    const secure = port === 465;
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: port,
      secure: secure,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
    });

    // Build vote link
    const siteUrl = (settings.site_url || '').replace(/\/$/, '');
    const voteUrl = `${siteUrl}/?token=${token}`;
    const fromName = settings.smtp_from_name || 'Ladderice Campaign';
    const fromEmail = settings.smtp_from_email;

    // CMS-driven content with defaults
    const emailSubject = settings.email_subject || 'Your Ladderice vote link is ready';
    const emailPreheader = settings.email_preheader || 'Choose where the campaign profit goes.';
    const emailHeading = settings.email_heading || 'Your Vote.\nYour Call.';
    const emailBody = settings.email_body || 'This purchase meant more than buying a piece from the drop. It put you inside the decision.\n\nNow you get to help choose where the campaign profit goes. Pick the cause that feels most important to you and cast your vote below.';
    const emailCtaText = settings.email_cta_text || 'Cast Your Vote';
    const emailFooterText = settings.email_footer_text || 'You\'re receiving this because you believed in the dream. Thank you.';
    const emailSignoff = settings.email_signoff || 'Ladderice';
    const safeName = escapeHtml(name || 'there');

    // Image URLs (absolute, from CMS uploads or static assets)
    const logoUrl = settings.logo_img
      ? `${siteUrl}${settings.logo_img}`
      : `${siteUrl}/public/ladderice-logo.png`;
    const productImgUrl = settings.product_1_img_1
      ? `${siteUrl}${settings.product_1_img_1}`
      : '';

    // ── HTML Email Template (aligned to campaign design language) ───────────
    const htmlBody = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(emailSubject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }

    body {
      font-family: 'IBM Plex Mono', Arial, Helvetica, sans-serif;
      background-color: #fafaf8;
      color: #181818;
    }

    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 0 20px !important; }
      .hero-title { font-size: 34px !important; line-height: 0.98 !important; }
      .meta-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .body-text { font-size: 14px !important; line-height: 1.75 !important; }
      .cta-link { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#fafaf8; font-family:Arial,Helvetica,sans-serif;">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;" aria-hidden="true">
    ${escapeHtml(emailPreheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf8;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%;">

          <tr>
            <td style="padding:0 0 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#181818; border:1px solid rgba(24,24,24,0.08);">
                <tr>
                  <td style="height:3px; background-color:#C41E1E; font-size:0; line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td class="meta-pad" style="padding:18px 28px 16px; text-align:center;">
                    <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(emailSignoff)}" width="110" style="display:inline-block; height:auto; max-width:110px;">
                    <p style="margin:12px 0 0; font-family:'IBM Plex Mono', 'Courier New', Courier, monospace; font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(255,255,255,0.46);">
                      ladderice / vote activation
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border:1px solid rgba(24,24,24,0.08);">
                <tr>
                  <td class="meta-pad" style="padding:18px 28px; border-bottom:1px solid rgba(24,24,24,0.06);">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:'IBM Plex Mono', 'Courier New', Courier, monospace; font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(24,24,24,0.38);">
                          ladderice campaign
                        </td>
                        <td align="right" style="font-family:'IBM Plex Mono', 'Courier New', Courier, monospace; font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:#C41E1E;">
                          cast your vote
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="meta-pad" style="padding:34px 28px 0;">
                    <p style="margin:0 0 14px; font-family:'IBM Plex Mono', 'Courier New', Courier, monospace; font-size:10px; letter-spacing:0.22em; text-transform:uppercase; color:#C41E1E;">
                      ladderice / vote access
                    </p>
                    <h1 class="hero-title" style="margin:0; font-family:'Druk Trial','Arial Black',Arial,Helvetica,sans-serif; font-size:42px; font-weight:900; line-height:0.94; letter-spacing:0.01em; text-transform:uppercase; color:#181818;">
                      ${escapeHtml(emailHeading).replace(/\n/g, '<br>')}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td class="meta-pad" style="padding:24px 28px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="height:1px; background-color:rgba(24,24,24,0.08); font-size:0; line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${productImgUrl ? `
                <tr>
                  <td style="padding:24px 0 0;">
                    <img src="${escapeHtml(productImgUrl)}" alt="The Campaign Kit" width="560" style="display:block; width:100%; height:auto; max-width:560px; object-fit:cover;">
                  </td>
                </tr>` : ''}
                <tr>
                  <td class="meta-pad body-text" style="padding:28px 28px 0; font-family:'IBM Plex Mono',Arial,Helvetica,sans-serif; font-size:14px; line-height:1.8; color:rgba(24,24,24,0.62);">
                    <p style="margin:0 0 16px;">
                      Hi ${safeName},
                    </p>
                    <p style="margin:0;">
                      ${escapeHtml(emailBody).replace(/\n/g, '<br>')}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td class="meta-pad" style="padding:30px 28px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:auto;">
                      <tr>
                        <td style="background-color:#181818;">
                          <a class="cta-link" href="${escapeHtml(voteUrl)}" target="_blank" rel="noopener" style="display:inline-block; padding:15px 28px; font-family:'IBM Plex Mono', 'Courier New', Courier, monospace; font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#ffffff; text-decoration:none;">
                            ${escapeHtml(emailCtaText)} &nbsp;→
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="meta-pad" style="padding:18px 28px 0;">
                    <p style="margin:0; font-family:'IBM Plex Mono', 'Courier New', Courier, monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(24,24,24,0.34); line-height:1.6;">
                      fallback link
                    </p>
                    <p style="margin:6px 0 0; font-family:'IBM Plex Mono', 'Courier New', Courier, monospace; font-size:11px; color:rgba(24,24,24,0.48); line-height:1.6; word-break:break-all;">
                      ${escapeHtml(voteUrl)}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 0 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="height:3px; background:linear-gradient(90deg, #C41E1E 0%, #C41E1E 24%, rgba(24,24,24,0.06) 24%); font-size:0; line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 8px 0; text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#181818;">
                <tr>
                  <td style="padding:20px 16px 18px; text-align:center;">
                    <p style="margin:0 0 12px;">
                      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(emailSignoff)}" width="96" style="display:inline-block; height:auto; max-width:96px;">
                    </p>
                    <p style="margin:0 0 8px; font-family:'IBM Plex Mono',Arial,Helvetica,sans-serif; font-size:11px; line-height:1.6; color:rgba(255,255,255,0.58);">
                      ${escapeHtml(emailFooterText)}
                    </p>
                    <p style="margin:0; font-family:'IBM Plex Mono', 'Courier New', Courier, monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.32);">
                      &copy; ${new Date().getFullYear()} ${escapeHtml(emailSignoff)}. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

    // ── Plain-text fallback ────────────────────────────────────────
    const textBody = `${emailHeading.replace(/\n/g, ' ')}

Hi ${name || 'there'},

${emailBody}

Cast your vote here:
${voteUrl}

---
${emailFooterText}
${new Date().getFullYear()} ${emailSignoff}. All rights reserved.`;

    // Send
    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: emailSubject,
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
  return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
}

module.exports = { sendVoteEmail };
