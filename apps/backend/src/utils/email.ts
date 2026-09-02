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
export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendEmail(params: {
  /** Resend accepts several recipients; used for the admin new-order alert. */
  to: string | string[];
  subject: string;
  html: string;
  /** Resend takes base64 content; the invoice PDF is the only user today. */
  attachments?: EmailAttachment[];
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
      ...(params.attachments?.length
        ? {
            attachments: params.attachments.map((a) => ({
              filename: a.filename,
              content: a.content.toString("base64"),
            })),
          }
        : {}),
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
    // Product names are admin-authored free text and land in an HTML email body, so they
    // are escaped here like every other interpolated string in this file.
    html: shell("Your pre-order is confirmed 🎉", `
      <p>Thanks for pre-ordering <strong>${escapeHtml(p.productName)}</strong>.</p>
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
      <p><strong>${escapeHtml(p.productName)}</strong> is available again.</p>
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

/**
 * Signup verification code.
 *
 * The code appears in the subject line and again as a bare
 * "NNNNNN is your ... code" sentence because that is what iOS/Android OTP autofill
 * heuristics key off — the mobile code field already sets `textContentType`.
 *
 * Unlike every other template here, the caller must NOT treat this as
 * fire-and-forget: if it fails, the account can never be created, so
 * `requestSignupOtpService` awaits the result and fails the request.
 */
export function sendSignupOtpEmail(to: string, p: {
  code: string;
  expiresInMinutes: number;
}) {
  return sendEmail({
    to,
    subject: `${p.code} is your Little Stepz verification code`,
    html: shell("Confirm your email ✉️", `
      <p>Enter this code to finish creating your Little Stepz account.</p>
      <p style="margin:0 0 24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#111">${p.code}</p>
      <p style="font-size:13px;color:#666">${p.code} is your Little Stepz verification code.</p>
      <p style="font-size:13px;color:#666">It expires in <strong>${p.expiresInMinutes} minutes</strong> and can only be used once.</p>
      <p style="font-size:13px;color:#666">Didn't try to sign up? Ignore this email — no account has been created, and none will be.</p>
    `),
  });
}

interface OrderEmailItem {
  name: string;
  quantity: number;
}

function itemRows(items: OrderEmailItem[]): string {
  if (!items.length) return "";
  return `<ul style="padding-left:18px;margin:0 0 16px">${items
    .map((i) => `<li style="margin-bottom:4px">${escapeHtml(i.name)} × ${i.quantity}</li>`)
    .join("")}</ul>`;
}

/** Product names come from the DB and land in an HTML email — escape them. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Tell the store owner an order came in.
 *
 * The in-app `ADMIN_NEW_ORDER` notification already existed, but push needs an Expo
 * device token that only the mobile app registers, and the web admin inbox neither
 * polls nor badges — so an owner who works in the browser only saw new orders by
 * opening the notifications page and reloading. Email is the channel that actually
 * reaches them.
 */
export function sendNewOrderAdminEmail(to: string | string[], p: {
  orderId: string;
  total: number | string;
  customerName: string;
  paymentMethod: string;
  items: OrderEmailItem[];
}) {
  const ref = p.orderId.slice(-8).toUpperCase();
  return sendEmail({
    to,
    subject: `New order #${ref} — ${money(p.total)} (${p.paymentMethod})`,
    html: shell("New order received 🛒", `
      <p><strong>#${ref}</strong> from ${escapeHtml(p.customerName)}.</p>
      <p style="margin:0 0 4px">Total: <strong>${money(p.total)}</strong></p>
      <p style="margin:0 0 16px">Payment: <strong>${escapeHtml(p.paymentMethod)}</strong></p>
      ${itemRows(p.items)}
      <p style="font-size:13px;color:#666">Open the admin panel to fulfil it.</p>
    `),
  });
}

/** Order confirmation for the customer. Regular orders had no email at all before. */
export function sendOrderConfirmationEmail(to: string, p: {
  orderId: string;
  total: number | string;
  paymentMethod: string;
  items: OrderEmailItem[];
  /** Tax invoice, when one could be generated. Absent is not an error. */
  invoice?: { filename: string; pdf: Buffer; number: string };
}) {
  const ref = p.orderId.slice(-8).toUpperCase();
  return sendEmail({
    to,
    subject: `Your Little Stepz order #${ref} is confirmed`,
    html: shell("Order confirmed ✅", `
      <p>Thanks for your order! We're getting it ready.</p>
      <p style="margin:0 0 4px">Order: <strong>#${ref}</strong></p>
      <p style="margin:0 0 16px">Total: <strong>${money(p.total)}</strong> (${escapeHtml(p.paymentMethod)})</p>
      ${itemRows(p.items)}
      ${p.invoice
        ? `<p style="font-size:13px;color:#666">Your tax invoice (<strong>${escapeHtml(p.invoice.number)}</strong>) is attached to this email.</p>`
        : ""}
      <p style="font-size:13px;color:#666">We'll email you again as soon as it ships.</p>
    `),
    ...(p.invoice
      ? { attachments: [{ filename: p.invoice.filename, content: p.invoice.pdf }] }
      : {}),
  });
}

/**
 * A partial order has been placed and its deposit captured.
 *
 * Sent INSTEAD of the standard confirmation, never alongside it: that one states the
 * order total as paid, which on a deposit order is wrong by four fifths. No GST invoice
 * is attached — the tax invoice is raised at dispatch so it can travel with the goods,
 * and what the customer has now is an advance payment, not a taxable supply receipt.
 */
export function sendPartialOrderPlacedEmail(to: string, p: {
  orderId: string;
  total: number | string;
  deposit: number | string;
  balance: number | string;
  items: { name: string; quantity: number }[];
}) {
  const ref = p.orderId.slice(-8).toUpperCase();
  return sendEmail({
    to,
    subject: `Order confirmed — deposit received (#${ref})`,
    html: shell("Your order is confirmed 🎉", `
      <p>Thanks for your order <strong>#${ref}</strong>.</p>
      <ul style="padding-left:18px;margin:12px 0">${itemRows(p.items)}</ul>
      <table style="margin:16px 0;font-size:14px">
        <tr><td style="padding:2px 12px 2px 0;color:#666">Order total</td><td><strong>${money(p.total)}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Deposit paid</td><td><strong>${money(p.deposit)}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Balance at delivery</td><td><strong>${money(p.balance)}</strong></td></tr>
      </table>
      <p>Please keep <strong>${money(p.balance)}</strong> ready — our delivery agent will collect it when your order arrives.</p>
      <p style="font-size:13px;color:#666">This is a payment receipt, not a tax invoice. Your GST invoice is issued when the order is dispatched.</p>
      <p style="font-size:13px;color:#666">The deposit is not refunded if the order is cancelled or delivery is refused, as set out in our cancellation policy.</p>
    `),
  });
}

/** The parcel has shipped and the courier will be collecting the balance. */
export function sendBalanceDueOnDispatchEmail(to: string, p: {
  orderId: string;
  balance: number | string;
  trackingUrl?: string | null;
}) {
  const ref = p.orderId.slice(-8).toUpperCase();
  return sendEmail({
    to,
    subject: `Your order has shipped — ${money(p.balance)} due on delivery (#${ref})`,
    html: shell("Your order is on its way 📦", `
      <p>Order <strong>#${ref}</strong> has been handed to our courier.</p>
      <p>Please keep <strong>${money(p.balance)}</strong> ready — the delivery agent will collect it at your door.</p>
      ${p.trackingUrl ? `<p style="margin:24px 0"><a href="${p.trackingUrl}" style="background:#111;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Track your order</a></p>` : ""}
    `),
  });
}

/** The deposit was retained after a cancellation or a refused delivery. */
export function sendDepositForfeitedEmail(to: string, p: {
  orderId: string;
  deposit: number | string;
  reason: string;
  policyUrl?: string;
}) {
  const ref = p.orderId.slice(-8).toUpperCase();
  return sendEmail({
    to,
    subject: `Order #${ref} closed — deposit retained`,
    html: shell("Your order has been closed", `
      <p>Order <strong>#${ref}</strong> has been closed: ${escapeHtml(p.reason)}.</p>
      <p>As set out in our cancellation policy, the <strong>${money(p.deposit)}</strong> deposit paid at checkout is retained and will not be refunded.</p>
      ${p.policyUrl ? `<p style="font-size:13px;color:#666"><a href="${p.policyUrl}">Read our cancellation policy</a></p>` : ""}
      <p style="font-size:13px;color:#666">If you believe this is a mistake, reply to this email and our team will look into it.</p>
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
      <p>We've received the balance for <strong>${escapeHtml(p.productName)}</strong>.</p>
      <p>Your order <strong>#${p.orderId.slice(-8).toUpperCase()}</strong> is now being processed and will ship soon.</p>
    `),
  });
}
