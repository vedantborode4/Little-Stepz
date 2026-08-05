import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
// Resend only sends from a domain verified by DNS in your Resend account, so this
// must stay an address on littlestepz.in — a gmail.com/outlook.com sender is rejected.
const FROM = process.env.EMAIL_FROM || "Little Stepz <Support@littlestepz.in>";
// Optional: where customer replies land, if that shouldn't be the From address.
const REPLY_TO = process.env.EMAIL_REPLY_TO;

const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Fail-soft email sender. Never throws — email problems must not break a
 * payment/transaction flow. Logs and returns false on failure.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping email:", params.subject);
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
    });
    if (error) {
      console.error("[email] send failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send threw:", err);
    return false;
  }
}

const money = (n: number | string) => `₹${Number(n).toLocaleString("en-IN")}`;

function shell(title: string, body: string) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#111">
    <h2 style="color:#111">${title}</h2>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
    <p style="font-size:12px;color:#888">Little Stepz</p>
  </div>`;
}

export function sendPreOrderBookedEmail(to: string, p: {
  productName: string;
  bookingAmount: number | string;
  balanceAmount: number | string;
}) {
  return sendEmail({
    to,
    subject: `Pre-order confirmed: ${p.productName}`,
    html: shell("Your pre-order is confirmed 🎉", `
      <p>Thanks for pre-ordering <strong>${p.productName}</strong>.</p>
      <p>Booking amount paid: <strong>${money(p.bookingAmount)}</strong></p>
      <p>Remaining balance due when it's back in stock: <strong>${money(p.balanceAmount)}</strong></p>
      <p>We'll email you a secure payment link the moment it arrives.</p>
    `),
  });
}

export function sendBackInStockEmail(to: string, p: {
  productName: string;
  balanceAmount: number | string;
  payUrl: string;
  dueDate: Date;
}) {
  const due = p.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return sendEmail({
    to,
    subject: `Back in stock — complete your pre-order for ${p.productName}`,
    html: shell("It's back in stock! ✅", `
      <p><strong>${p.productName}</strong> is available again.</p>
      <p>Pay the remaining balance of <strong>${money(p.balanceAmount)}</strong> to confirm your order.</p>
      <p style="margin:24px 0">
        <a href="${p.payUrl}" style="background:#111;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Pay balance now</a>
      </p>
      <p style="font-size:13px;color:#666">This link is valid until <strong>${due}</strong>. After that the reservation may be released.</p>
    `),
  });
}

export function sendAffiliateInviteEmail(to: string, p: { inviteUrl: string }) {
  return sendEmail({
    to,
    subject: "You're invited to join the Little Stepz Affiliate Program",
    html: shell("Become a Little Stepz Affiliate 🤝", `
      <p>You've been invited to join the <strong>Little Stepz Affiliate Program</strong>.</p>
      <p>Earn commission for every customer you refer. Apply using the link below to get started:</p>
      <p style="margin:24px 0">
        <a href="${p.inviteUrl}" style="background:#111;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Apply now</a>
      </p>
      <p style="font-size:13px;color:#666">Or copy this link into your browser: ${p.inviteUrl}</p>
    `),
  });
}

export function sendPasswordResetEmail(to: string, p: {
  code: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  return sendEmail({
    to,
    subject: "Reset your Little Stepz password",
    html: shell("Reset your password 🔐", `
      <p>We received a request to reset the password for this account.</p>
      <p style="margin:20px 0 8px;font-size:13px;color:#666">Using the app? Enter this code:</p>
      <p style="margin:0 0 24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#111">${p.code}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#666">On the web? Use this link instead:</p>
      <p style="margin:0 0 24px">
        <a href="${p.resetUrl}" style="background:#111;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a>
      </p>
      <p style="font-size:13px;color:#666">Or copy this link into your browser: ${p.resetUrl}</p>
      <p style="font-size:13px;color:#666">This code and link expire in <strong>${p.expiresInMinutes} minutes</strong> and can only be used once.</p>
      <p style="font-size:13px;color:#666">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `),
  });
}

export function sendPasswordChangedEmail(to: string) {
  return sendEmail({
    to,
    subject: "Your Little Stepz password was changed",
    html: shell("Your password was changed ✅", `
      <p>The password for your Little Stepz account was just changed, and you've been signed out on all devices.</p>
      <p>If this was you, nothing else to do — just sign in with your new password.</p>
      <p style="font-size:13px;color:#666">If this <strong>wasn't</strong> you, reset your password immediately and contact us.</p>
    `),
  });
}

export function sendBalancePaidEmail(to: string, p: {
  productName: string;
  orderId: string;
}) {
  return sendEmail({
    to,
    subject: `Payment complete — your order is confirmed`,
    html: shell("Order confirmed 🎉", `
      <p>We've received the balance for <strong>${p.productName}</strong>.</p>
      <p>Your order <strong>#${p.orderId.slice(-8).toUpperCase()}</strong> is now being processed and will ship soon.</p>
    `),
  });
}
