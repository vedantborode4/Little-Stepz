import PDFDocument from "pdfkit";

/**
 * Renders the tax invoice PDF.
 *
 * Currency is written as "Rs." rather than "₹": pdfkit's built-in Helvetica is a
 * standard PDF font whose WinAnsi encoding has no rupee glyph (U+20B9), so the
 * symbol renders as a black box. Embedding a Unicode TTF would fix it at the cost
 * of shipping a ~500KB font in the repo — not worth it for one character on a
 * document whose currency is already stated as INR.
 */

export interface InvoicePdfData {
  number: string;
  issuedAt: Date;
  orderId: string;
  orderDate: Date;
  seller: {
    name: string; gstin: string; pan: string; address: string;
    state: string; stateCode: string; email: string; phone: string; website: string;
  };
  buyer: {
    name: string; email: string; phone: string | null;
    address: string; city: string; state: string; pincode: string;
  };
  placeOfSupply: string;
  isIntraState: boolean;
  gstRate: string;
  items: {
    name: string; variantName: string | null; quantity: number;
    gross: string; taxable: string; tax: string;
  }[];
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
  grandTotal: string;
  paymentMethod: string;
}

const money = (v: string | number) =>
  `Rs. ${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

const INK = "#111111";
const MUTED = "#555555";
const LINE = "#cccccc";

export function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    // ── Title ───────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK)
      .text("Tax Invoice", left, 40, { width, align: "center" });

    // ── Seller / invoice meta ───────────────────────────────────────────
    let y = 72;
    doc.font("Helvetica-Bold").fontSize(9).text("Sold By", left, y);
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(data.seller.name, left, y + 12, { width: width * 0.55 })
      .text(data.seller.address, { width: width * 0.55 });

    const sellerBottom = doc.y;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.5)
      // Loud rather than blank: an invoice without a GSTIN is not a valid tax
      // invoice, and an empty field reads like a rendering bug.
      .text(`GSTIN: ${data.seller.gstin || "NOT CONFIGURED"}`, left, sellerBottom + 3);
    if (data.seller.pan) doc.text(`PAN: ${data.seller.pan}`, left, doc.y);

    const metaX = left + width * 0.6;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK)
      .text("Invoice No.", metaX, y);
    doc.font("Helvetica").fillColor(MUTED).text(data.number, metaX, y + 12);
    doc.font("Helvetica-Bold").fillColor(INK).text("Invoice Date", metaX, y + 28);
    doc.font("Helvetica").fillColor(MUTED).text(day(data.issuedAt), metaX, y + 40);
    doc.font("Helvetica-Bold").fillColor(INK).text("Order ID", metaX, y + 56);
    doc.font("Helvetica").fillColor(MUTED).fontSize(8)
      .text(data.orderId, metaX, y + 68, { width: width * 0.4 });
    doc.fontSize(9).font("Helvetica-Bold").fillColor(INK).text("Order Date", metaX, y + 84);
    doc.font("Helvetica").fillColor(MUTED).text(day(data.orderDate), metaX, y + 96);

    y = Math.max(doc.y, sellerBottom + 30) + 14;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).lineWidth(0.7).stroke();

    // ── Buyer ───────────────────────────────────────────────────────────
    y += 12;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Billing / Shipping Address", left, y);
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(data.buyer.name, left, y + 13, { width: width * 0.55 })
      .text(data.buyer.address, { width: width * 0.55 })
      .text(`${data.buyer.city}, ${data.buyer.state} - ${data.buyer.pincode}`, { width: width * 0.55 });
    if (data.buyer.phone) doc.text(`Phone: ${data.buyer.phone}`, { width: width * 0.55 });

    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Place of Supply", metaX, y);
    doc.font("Helvetica").fillColor(MUTED).text(data.placeOfSupply || "—", metaX, y + 13);
    doc.font("Helvetica-Bold").fillColor(INK).text("Payment", metaX, y + 29);
    doc.font("Helvetica").fillColor(MUTED).text(data.paymentMethod, metaX, y + 42);

    y = doc.y + 16;

    // ── Line items ──────────────────────────────────────────────────────
    const cols = {
      desc: left,
      qty: left + width * 0.52,
      taxable: left + width * 0.62,
      tax: left + width * 0.78,
      total: left + width * 0.88,
    };
    const colW = { qty: width * 0.08, taxable: width * 0.14, tax: width * 0.09, total: width * 0.12 };

    doc.rect(left, y, width, 20).fillColor("#f2f2f2").fill();
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.5)
      .text("Description", cols.desc + 4, y + 6, { width: width * 0.5 })
      .text("Qty", cols.qty, y + 6, { width: colW.qty, align: "right" })
      .text("Taxable", cols.taxable, y + 6, { width: colW.taxable, align: "right" })
      .text(`GST ${data.gstRate}%`, cols.tax, y + 6, { width: colW.tax, align: "right" })
      .text("Total", cols.total, y + 6, { width: colW.total, align: "right" });

    y += 20;
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);

    for (const item of data.items) {
      const label = item.variantName ? `${item.name} (${item.variantName})` : item.name;
      const h = doc.heightOfString(label, { width: width * 0.5 }) + 10;

      // Start a new page before a row would be clipped by the footer.
      if (y + h > doc.page.height - 140) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      doc.fillColor(INK).text(label, cols.desc + 4, y + 4, { width: width * 0.5 });
      doc.fillColor(MUTED)
        .text(String(item.quantity), cols.qty, y + 4, { width: colW.qty, align: "right" })
        .text(money(item.taxable), cols.taxable, y + 4, { width: colW.taxable, align: "right" })
        .text(money(item.tax), cols.tax, y + 4, { width: colW.tax, align: "right" })
        .text(money(item.gross), cols.total, y + 4, { width: colW.total, align: "right" });

      y += h;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#eeeeee").lineWidth(0.5).stroke();
    }

    // ── Totals ──────────────────────────────────────────────────────────
    y += 10;
    const labelX = left + width * 0.55;
    const valueX = left + width * 0.78;
    const valueW = width * 0.22;

    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9)
        .fillColor(bold ? INK : MUTED)
        .text(label, labelX, y, { width: width * 0.22 })
        .text(value, valueX, y, { width: valueW, align: "right" });
      y += 15;
    };

    row("Taxable Value", money(data.taxableValue));
    if (data.isIntraState) {
      row(`CGST @ ${(Number(data.gstRate) / 2).toFixed(2)}%`, money(data.cgst));
      row(`SGST @ ${(Number(data.gstRate) / 2).toFixed(2)}%`, money(data.sgst));
    } else {
      row(`IGST @ ${Number(data.gstRate).toFixed(2)}%`, money(data.igst));
    }
    doc.moveTo(labelX, y).lineTo(right, y).strokeColor(LINE).lineWidth(0.7).stroke();
    y += 8;
    row("Grand Total", money(data.grandTotal), true);

    // ── Declaration ─────────────────────────────────────────────────────
    y += 14;
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(
      "Declaration: All prices are inclusive of GST. This is a computer-generated invoice " +
      "and does not require a physical signature. Goods once sold are covered by the returns " +
      "and warranty policies published on our website.",
      left, y, { width: width * 0.62 }
    );

    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK)
      .text(`For ${data.seller.name}`, metaX, y, { width: width * 0.38, align: "right" });
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text("Authorised Signatory", metaX, y + 34, { width: width * 0.38, align: "right" });

    // ── Footer ──────────────────────────────────────────────────────────
    const footerY = doc.page.height - 70;
    doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor(LINE).lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(
      `${data.seller.name} · ${data.seller.email} · ${data.seller.phone} · ${data.seller.website}`,
      left, footerY + 8, { width, align: "center" }
    );
    doc.text("All values are in INR.", left, footerY + 20, { width, align: "center" });

    doc.end();
  });
}
