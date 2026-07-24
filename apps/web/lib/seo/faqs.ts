/**
 * Single source of truth for the FAQ — consumed by both the visible page
 * (app/faq/page.tsx) and the FAQPage JSON-LD (app/faq/layout.tsx).
 *
 * Google requires FAQ structured data to match the text visible on the page,
 * so these must never be maintained in two places.
 *
 * Answers are written to stand alone (plan W10): each names Little Stepz and
 * restates the subject, because an AI engine extracts a single Q&A pair without
 * the surrounding page. "Yes, we accept returns" is useless once quoted;
 * "Little Stepz accepts returns for damaged, defective or incorrect items" is
 * citable.
 */

export interface Faq {
  q: string
  a: string
}

export const FAQS: Faq[] = [
  {
    q: "Do you offer Cash on Delivery (COD)?",
    a: "Little Stepz offers Cash on Delivery on selected products and locations. Some COD orders may require an advance confirmation fee before dispatch.",
  },
  {
    q: "Why do you ask for advance payment for COD?",
    a: "Little Stepz asks for a COD advance to prevent fake or abandoned orders and to confirm the order is genuine. The advance is adjusted against the order total.",
  },
  {
    q: "How long does shipping take?",
    a: "Little Stepz orders are usually delivered within 2–7 business days across India, depending on the delivery location.",
  },
  {
    q: "Can I cancel my order?",
    a: "Little Stepz accepts order cancellations before dispatch. Once an order has shipped, cancellation may no longer be possible.",
  },
  {
    q: "Do you accept returns?",
    a: "Little Stepz accepts returns only for eligible damaged, defective or incorrect products, as set out in the returns policy. Change-of-mind returns are not accepted.",
  },
  {
    q: "Is an unboxing video mandatory?",
    a: "Yes. Little Stepz requires a full, uninterrupted unboxing video for any damage, missing-item or return claim. Claims without unboxing proof cannot be processed.",
  },
  {
    q: "Do you provide warranty?",
    a: "Eligible electronics sold by Little Stepz carry a limited warranty against manufacturing defects. Warranty terms vary by product and are listed on the product page.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Little Stepz accepts UPI, debit and credit cards, net banking, wallets, and Cash on Delivery where available.",
  },
  {
    q: "Do you offer international shipping?",
    a: "Little Stepz ships across India. International shipping depends on operational availability — contact support to check for your country.",
  },
  {
    q: "What if my product arrives damaged?",
    a: "Contact Little Stepz support within 48 hours of delivery with the mandatory unboxing video. Damage claims are assessed against that footage.",
  },
  {
    q: "Can I return a product if I change my mind?",
    a: "No. Little Stepz does not accept change-of-mind returns. Returns are limited to damaged, defective or incorrect items.",
  },
  {
    q: "What if I entered the wrong address?",
    a: "Contact Little Stepz support immediately, before dispatch, to correct a delivery address. Re-shipping charges may apply if a delivery fails because of an incorrect address.",
  },
]
