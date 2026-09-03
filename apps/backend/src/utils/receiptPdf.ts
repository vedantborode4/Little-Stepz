import PDFDocument from "pdfkit";

/**
 * A deposit acknowledgement for a partial-payment order.
 *
 * Deliberately NOT a tax invoice and deliberately not rendered by `invoicePdf.ts`:
 *
 *  - It must not carry an InvoiceCounter number. That series is a legally gap-free
 *    sequence of tax invoices, and burning numbers on non-invoices is a real GST
 *    problem. The reference here is derived from the order and financial year instead.
 *  - It must not show a GST breakup. No taxable supply has occurred yet — the tax
 *    invoice is raised at dispatch, and showing CGST/SGST on an advance would invite
 *    the customer to claim credit against a document that does not support it.
 *  - It says what it is, twice, because a PDF that looks like an invoice will be
 *    treated as one.
 */
export interface ReceiptPdfData {
  reference: string;
  issuedAt: Date;
  orderId: string;
  /** What the id above is called on the page. A pre-order has no order yet. */
  orderIdLabel?: string;
  /** Overrides the strapline under the title; still must not claim to be an invoice. */
  subtitle?: string;
  orderDate: Date;
  seller: {
    name: string; gstin: string; pan: string; address: string;
    state: string; stateCode: string; email: string; phone: string; website: string;
  };
  buyer: {
    name: string; email: string; phone: string | null;
    address: string; city: string; state: string; pincode: string;
  };
  items: { name: string; variantName: string | null; quantity: number; gross: string }[];
  orderTotal: string;
  depositPaid: string;
  balanceDue: string;
}

const money = (v: string | number) =>
  `Rs. ${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

const INK = "#111111";
const MUTED = "#555555";
const LINE = "#cccccc";

export function renderReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK)
      .text("Payment Receipt", left, 40, { width, align: "center" });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(data.subtitle ?? "Advance payment against order — this is not a tax invoice", left, 60, {
        width, align: "center",
      });

    let y = 86;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Received By", left, y);
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(data.seller.name, left, y + 12, { width: width * 0.55 })
      .text(data.seller.address, { width: width * 0.55 });

    const sellerBottom = doc.y;
    if (data.seller.gstin) {
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.5)
        .text(`GSTIN: ${data.seller.gstin}`, left, sellerBottom + 3);
    }

    const metaX = left + width * 0.6;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Receipt No.", metaX, y);
    doc.font("Helvetica").fillColor(MUTED).text(data.reference, metaX, y + 12);
    doc.font("Helvetica-Bold").fillColor(INK).text("Receipt Date", metaX, y + 28);
    doc.font("Helvetica").fillColor(MUTED).text(day(data.issuedAt), metaX, y + 40);
    doc.font("Helvetica-Bold").fillColor(INK).text(data.orderIdLabel ?? "Order ID", metaX, y + 56);
    doc.font("Helvetica").fillColor(MUTED).fontSize(8)
      .text(data.orderId, metaX, y + 68, { width: width * 0.4 });
    doc.fontSize(9).font("Helvetica-Bold").fillColor(INK).text("Order Date", metaX, y + 84);
    doc.font("Helvetica").fillColor(MUTED).text(day(data.orderDate), metaX, y + 96);

    y = Math.max(doc.y, sellerBottom + 30) + 14;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).lineWidth(0.7).stroke();

    y += 12;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Received From", left, y);
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(data.buyer.name, left, y + 13, { width: width * 0.55 })
      .text(data.buyer.address, { width: width * 0.55 })
      .text(`${data.buyer.city}, ${data.buyer.state} - ${data.buyer.pincode}`, { width: width * 0.55 });
    if (data.buyer.phone) doc.text(`Phone: ${data.buyer.phone}`, { width: width * 0.55 });

    y = doc.y + 16;

    // ── Items: description and gross only. No taxable/tax columns — see the note
    //    at the top of this file. ────────────────────────────────────────────────
    const cols = { desc: left, qty: left + width * 0.62, total: left + width * 0.8 };

    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK)
      .text("Description", cols.desc, y)
      .text("Qty", cols.qty, y)
      .text("Amount", cols.total, y, { width: width * 0.2, align: "right" });

    y = doc.y + 4;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).lineWidth(0.7).stroke();
    y += 6;

    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
    for (const item of data.items) {
      const label = item.variantName ? `${item.name} (${item.variantName})` : item.name;
      const startY = y;
      doc.text(label, cols.desc, y, { width: width * 0.58 });
      const rowBottom = doc.y;
      doc.text(String(item.quantity), cols.qty, startY);
      doc.text(money(item.gross), cols.total, startY, { width: width * 0.2, align: "right" });
      y = Math.max(rowBottom, startY + 12) + 4;

      if (y > doc.page.height - 200) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    }

    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).lineWidth(0.7).stroke();
    y += 10;

    const labelX = left + width * 0.55;
    const valueOpts = { width: width * 0.25, align: "right" as const };

    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text("Order total", labelX, y)
      .text(money(data.orderTotal), cols.total, y, valueOpts);
    y = doc.y + 4;

    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
      .text("Amount received", labelX, y)
      .text(money(data.depositPaid), cols.total, y, valueOpts);
    y = doc.y + 4;

    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text("Balance due on delivery", labelX, y)
      .text(money(data.balanceDue), cols.total, y, valueOpts);
    y = doc.y + 20;

    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
      "This receipt acknowledges an advance payment and is not a tax invoice. A GST tax " +
      "invoice for the full order value is issued when your order is dispatched. The balance " +
      "shown above is collected at the time of delivery.",
      left, y, { width }
    );
    y = doc.y + 8;
    doc.text(
      "The advance paid is non-refundable if delivery is refused or the order is cancelled, " +
      "as set out in our cancellation policy.",
      left, y, { width }
    );

    doc.end();
  });
}
