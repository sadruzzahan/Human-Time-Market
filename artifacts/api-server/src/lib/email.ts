import { logger } from "./logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "Human Time Market <noreply@htm.local>";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * Send a transactional email. If RESEND_API_KEY is not configured the
 * email is logged locally so the rest of the system continues to work
 * in development. Returns true on success, false on failure (callers
 * may persist the failure for retry by a background worker).
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  if (!RESEND_API_KEY) {
    logger.info({ to: msg.to, subject: msg.subject }, "[email:stub] would send email");
    return true;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn({ status: res.status, body, to: msg.to }, "Resend send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, to: msg.to }, "Resend send threw");
    return false;
  }
}

const APP_URL = process.env.APP_URL ?? process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "http://localhost:5000";

const baseStyles = `font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background:#0b0d10; color:#e6e8eb; padding:24px; line-height:1.5;`;
const card = `background:#13171c; border:1px solid #1f242b; padding:20px; border-radius:6px;`;
const ctaStyle = `display:inline-block; margin-top:16px; padding:10px 16px; background:#06b6d4; color:#0b0d10; text-decoration:none; font-weight:600; border-radius:4px;`;

export function renderEmailTemplate(opts: {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaPath?: string;
}): { html: string; text: string } {
  const ctaUrl = opts.ctaPath ? `${APP_URL}${opts.ctaPath}` : null;
  const html = `<!doctype html><html><body style="${baseStyles}">
    <div style="${card}">
      <h2 style="margin:0 0 12px 0; color:#06b6d4; font-family:inherit;">${escapeHtml(opts.heading)}</h2>
      <p style="margin:0 0 12px 0;">${escapeHtml(opts.body)}</p>
      ${ctaUrl && opts.ctaLabel ? `<a href="${ctaUrl}" style="${ctaStyle}">${escapeHtml(opts.ctaLabel)}</a>` : ""}
      <p style="margin-top:24px; font-size:12px; color:#6b7280;">
        Human Time Market &middot; You are receiving this because of activity on your account.
        Manage notification preferences in your dashboard settings.
      </p>
    </div>
  </body></html>`;
  const text = `${opts.heading}\n\n${opts.body}${ctaUrl ? `\n\n${opts.ctaLabel ?? "Open"}: ${ctaUrl}` : ""}\n\n— Human Time Market`;
  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
