/**
 * Nayoure — Contact Form Handler
 * Cloudflare Pages Function: POST /api/contact
 *
 * Required binding (set in Cloudflare Pages dashboard → Settings → Functions):
 *   Email binding  name: CONTACT_EMAIL
 *                  destination: info@nayoure.com
 *
 * Required Email Routing setup (Cloudflare dashboard → Email → Email Routing):
 *   1. Enable Email Routing for nayoure.com
 *   2. Add catch-all or specific rule: contact@nayoure.com → your inbox
 *   3. Verify destination email address
 */

import { EmailMessage } from 'cloudflare:email';

const SENDER_ADDRESS = 'contact@nayoure.com';
const RECIPIENT_ADDRESS = 'info@nayoure.com';
const ALLOWED_ORIGINS = ['https://nayoure.com', 'https://www.nayoure.com'];

// Max field lengths (RFC 5321 / reasonable UX caps)
const MAX_LENGTHS = { name: 100, email: 254, phone: 30, company: 200, message: 4000 };

// Strip CRLF and null bytes to prevent MIME header injection
function sanitizeHeader(str) {
  return String(str ?? '').replace(/[\r\n\0]/g, '');
}

// Validate and truncate a field value
function sanitizeField(str, max) {
  return String(str ?? '').trim().slice(0, max);
}

// ── CORS headers ─────────────────────────────────────────────────
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// ── Handle preflight ─────────────────────────────────────────────
export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('Origin') || ''),
  });
}

// ── Main handler ─────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';

  // Parse JSON body
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Invalid request body.' }, 400, origin);
  }

  // Sanitize and cap all fields
  const name    = sanitizeField(body.name,    MAX_LENGTHS.name);
  const email   = sanitizeField(body.email,   MAX_LENGTHS.email);
  const phone   = sanitizeField(body.phone,   MAX_LENGTHS.phone);
  const company = sanitizeField(body.company, MAX_LENGTHS.company);
  const message = sanitizeField(body.message, MAX_LENGTHS.message);

  // Inquiry must be one of the known values
  const VALID_INQUIRIES = ['General Inquiry','Product Inquiry','Wholesale / Bulk Order','Private Label','Custom Formulation','Partnership'];
  const inquiry = VALID_INQUIRIES.includes(body.inquiry) ? body.inquiry : 'General Inquiry';

  // ── Validation ───────────────────────────────────────────────
  if (!name || !email || !message) {
    return json({ success: false, error: 'Name, email, and message are required.' }, 400, origin);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ success: false, error: 'Invalid email address.' }, 400, origin);
  }

  if (message.length < 10) {
    return json({ success: false, error: 'Message is too short.' }, 400, origin);
  }

  // ── Build MIME email ─────────────────────────────────────────
  // sanitizeHeader() strips \r\n to prevent MIME header injection
  const subject = `[Nayoure] ${sanitizeHeader(inquiry)} – ${sanitizeHeader(name)}`;
  const rawEmail = buildMimeEmail({
    from:    SENDER_ADDRESS,
    to:      RECIPIENT_ADDRESS,
    replyTo: email.trim(),
    subject,
    name:    name.trim(),
    email:   email.trim(),
    phone:   phone?.trim() || 'Not provided',
    company: company?.trim() || 'Not provided',
    inquiry: inquiry || 'General Inquiry',
    message: message.trim(),
  });

  // ── Send via Cloudflare Email binding ────────────────────────
  try {
    const msg = new EmailMessage(SENDER_ADDRESS, RECIPIENT_ADDRESS, rawEmail);
    await env.CONTACT_EMAIL.send(msg);
  } catch (err) {
    console.error('Email send error:', err?.message ?? err);
    return json({ success: false, error: 'Failed to send email. Please try again.' }, 500, origin);
  }

  return json({ success: true, message: 'Your message has been sent.' }, 200, origin);
}

// ── RFC 2822-compliant MIME builder (no external deps) ───────────
function buildMimeEmail({ from, to, replyTo, subject, name, email, phone, company, inquiry, message }) {
  const boundary = `----=_NayoureBoundary_${Date.now()}`;
  const date = new Date().toUTCString();

  const plainText = [
    `New contact form submission from nayoure.com`,
    ``,
    `Name:     ${name}`,
    `Email:    ${email}`,
    `Phone:    ${phone}`,
    `Company:  ${company}`,
    `Inquiry:  ${inquiry}`,
    ``,
    `Message:`,
    `----------`,
    message,
    `----------`,
    ``,
    `Sent from: https://nayoure.com`,
  ].join('\r\n');

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f7f0;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f0;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(27,94,32,.12);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d3320,#1B5E20);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;font-size:28px;color:#fff;font-family:Georgia,serif;font-style:italic;">Nayoure</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:13px;">New Contact Form Submission</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 24px;font-size:20px;color:#1A2E1A;font-family:Georgia,serif;">You have a new inquiry</h2>

            <table width="100%" cellpadding="0" cellspacing="0">
              ${buildRow('Name',    name,    '#F1F8E9')}
              ${buildRow('Email',   `<a href="mailto:${he(email)}" style="color:#2E7D32;">${he(email)}</a>`, '#ffffff')}
              ${buildRow('Phone',   phone,   '#F1F8E9')}
              ${buildRow('Company', company, '#ffffff')}
              ${buildRow('Inquiry', `<strong style="color:#2E7D32;">${he(inquiry)}</strong>`, '#F1F8E9')}
            </table>

            <div style="margin-top:24px;background:#f9fbf6;border-left:4px solid #4CAF50;padding:20px 24px;border-radius:0 8px 8px 0;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6B7F6B;">Message</p>
              <p style="margin:0;font-size:15px;color:#1A2E1A;line-height:1.7;white-space:pre-wrap;">${he(message)}</p>
            </div>

            <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e8f0de;">
              <a href="mailto:${he(email)}" style="display:inline-block;padding:12px 28px;background:#1B5E20;color:#fff;text-decoration:none;border-radius:99px;font-size:14px;font-weight:600;">
                Reply to ${he(name)}
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f7f0;padding:20px 40px;text-align:center;border-top:1px solid #e8f0de;">
            <p style="margin:0;font-size:12px;color:#6B7F6B;">This email was sent from the contact form at <a href="https://nayoure.com" style="color:#2E7D32;">nayoure.com</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Assemble multipart/alternative MIME message
  const lines = [
    `Date: ${date}`,
    `From: Nayoure Website <${from}>`,
    `To: Nayoure <${to}>`,
    `Reply-To: ${name} <${replyTo}>`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    plainText,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlBody,
    ``,
    `--${boundary}--`,
  ];

  return lines.join('\r\n');
}

function buildRow(label, value, bg) {
  return `<tr style="background:${bg};">
    <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6B7F6B;width:100px;white-space:nowrap;">${label}</td>
    <td style="padding:12px 16px;font-size:15px;color:#1A2E1A;">${value}</td>
  </tr>`;
}

// Minimal HTML escaping — prevents XSS in the email body
function he(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
