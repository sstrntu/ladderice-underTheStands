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
    const emailSubject = settings.email_subject || 'Your vote is ready — Ladderice Campaign';
    const emailPreheader = settings.email_preheader || 'You\'ve been selected to vote on where our campaign profit goes.';
    const emailHeading = settings.email_heading || 'Your Vote\nis Ready';
    const emailBody = settings.email_body || 'Thank you for supporting the Ladderice campaign. You\'ve been selected to vote on where our campaign profit goes — choose one of three causes that matter to you.';
    const emailCtaText = settings.email_cta_text || 'Cast Your Vote';
    const emailFooterText = settings.email_footer_text || 'You received this email because you purchased from the Ladderice campaign.';
    const emailSignoff = settings.email_signoff || 'Ladderice';
    const safeName = escapeHtml(name || 'there');

    // Image URLs (absolute, from CMS uploads or static assets)
    const logoUrl = settings.logo_img
      ? `${siteUrl}${settings.logo_img}`
      : `${siteUrl}/public/ladderice-logo.png`;
    const productImgUrl = settings.product_1_img_1
      ? `${siteUrl}${settings.product_1_img_1}`
      : '';

    // ── HTML Email Template (ALD-inspired) ──────────────────────────
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
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }

    /* Typography — web-safe fallbacks that echo ALD aesthetic */
    body {
      font-family: Georgia, 'Times New Roman', Times, serif;
      background-color: #f5f3ef;
      color: #181818;
    }

    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 0 20px !important; }
      .heading { font-size: 36px !important; line-height: 1.1 !important; }
      .body-text { font-size: 15px !important; }
      .cta-btn { padding: 16px 36px !important; }
      .side-padding { padding-left: 28px !important; padding-right: 28px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f5f3ef; font-family:Georgia,'Times New Roman',Times,serif;">

  <!-- Preheader (hidden text for email preview) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;" aria-hidden="true">
    ${escapeHtml(emailPreheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f3ef;">
    <tr>
      <td align="center" style="padding: 48px 16px;">

        <!-- Inner container -->
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%;">

          <!-- ── Top bar (thin accent line) ── -->
          <tr>
            <td style="padding: 0 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:2px; background-color:#C41E1E; font-size:0; line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Brand / Logo on dark bar ── -->
          <tr>
            <td style="padding: 0 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#181818;">
                <tr>
                  <td style="padding: 24px 32px; text-align:center;">
                    <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(emailSignoff)}" width="110" style="display:inline-block; height:auto; max-width:110px;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Main card ── -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border:1px solid rgba(24,24,24,0.08);">

                <!-- Heading area -->
                <tr>
                  <td class="side-padding" style="padding: 56px 48px 0;">
                    <!-- Eyebrow -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:24px; height:1px; background-color:rgba(24,24,24,0.2);"></td>
                        <td style="padding-left:10px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:10px; font-weight:500; letter-spacing:0.25em; text-transform:uppercase; color:rgba(24,24,24,0.35);">
                          Cast Your Vote
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Main heading -->
                <tr>
                  <td class="side-padding" style="padding: 20px 48px 0;">
                    <h1 class="heading" style="margin:0; font-family:Georgia,'Times New Roman',Times,serif; font-size:42px; font-weight:normal; line-height:1.08; letter-spacing:-0.02em; color:#181818;">
                      ${escapeHtml(emailHeading).replace(/\n/g, '<br>')}
                    </h1>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td class="side-padding" style="padding: 32px 48px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="height:1px; background-color:rgba(24,24,24,0.08); font-size:0; line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${productImgUrl ? `<!-- Product Image -->
                <tr>
                  <td style="padding: 32px 0 0;">
                    <img src="${escapeHtml(productImgUrl)}" alt="The Campaign Kit" width="560" style="display:block; width:100%; height:auto; max-width:560px; object-fit:cover;" class="product-img">
                  </td>
                </tr>` : ''}

                <!-- Greeting + Body -->
                <tr>
                  <td class="side-padding" style="padding: 32px 48px 0;">
                    <p class="body-text" style="margin:0 0 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; font-weight:300; line-height:1.75; color:rgba(24,24,24,0.55);">
                      Hi ${safeName},
                    </p>
                    <p class="body-text" style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; font-weight:300; line-height:1.75; color:rgba(24,24,24,0.55);">
                      ${escapeHtml(emailBody).replace(/\n/g, '<br>')}
                    </p>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td class="side-padding" style="padding: 40px 48px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:#181818;">
                          <a href="${escapeHtml(voteUrl)}" target="_blank" rel="noopener" style="display:inline-block; padding:15px 36px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:11px; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:#ffffff; text-decoration:none; mso-padding-alt:0;">
                            <!--[if mso]><i style="letter-spacing:12px;mso-font-width:-100%;mso-text-raise:22pt">&nbsp;</i><![endif]-->
                            <span style="mso-text-raise:11pt;">${escapeHtml(emailCtaText)} &nbsp;&rarr;</span>
                            <!--[if mso]><i style="letter-spacing:12px;mso-font-width:-100%">&nbsp;</i><![endif]-->
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Link fallback -->
                <tr>
                  <td class="side-padding" style="padding: 20px 48px 0;">
                    <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:11px; color:rgba(24,24,24,0.3); line-height:1.5;">
                      Or copy this link:
                    </p>
                    <p style="margin:4px 0 0; font-family:'Courier New',Courier,monospace; font-size:11px; color:rgba(24,24,24,0.4); line-height:1.5; word-break:break-all;">
                      ${escapeHtml(voteUrl)}
                    </p>
                  </td>
                </tr>

                <!-- Bottom padding -->
                <tr>
                  <td style="padding: 48px 0 0; font-size:0; line-height:0;">&nbsp;</td>
                </tr>

                <!-- Bottom accent line -->
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="height:2px; background: linear-gradient(90deg, #C41E1E 0%, #C41E1E 30%, rgba(24,24,24,0.06) 30%); font-size:0; line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding: 36px 0 0; text-align:center;">
              <!-- Brand name -->
              <p style="margin:0 0 12px; font-family:Georgia,'Times New Roman',Times,serif; font-size:16px; font-weight:normal; letter-spacing:-0.01em; color:#181818;">
                ${escapeHtml(emailSignoff)}
              </p>

              <!-- Footer text -->
              <p style="margin:0 0 8px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:11px; line-height:1.6; color:rgba(24,24,24,0.3);">
                ${escapeHtml(emailFooterText)}
              </p>

              <!-- Copyright -->
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:0.08em; color:rgba(24,24,24,0.2);">
                &copy; ${new Date().getFullYear()} ${escapeHtml(emailSignoff)}. All rights reserved.
              </p>
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
