import type { PolicyPage } from "../types";

export const cancellation: PolicyPage = {
  slug: "cancellation",
  title: "Cancellation Policy",
  intro:
    "At Little Stepz, we understand that customers may sometimes need to cancel an order. Please review our cancellation terms below.",
  sections: [
    {
      heading: "Order Cancellation Before Dispatch",
      blocks: [
        {
          type: "paragraph",
          text: "Orders may be cancelled only before they are processed and dispatched from our warehouse.",
        },
        {
          type: "paragraph",
          text: "If your order has not yet been shipped, cancellation requests may be accepted subject to order verification.",
        },
      ],
    },
    {
      heading: "Orders Already Dispatched",
      blocks: [
        {
          type: "paragraph",
          text: "Once an order has been packed, shipped, or handed over to the courier partner, cancellation requests will not be accepted.",
        },
      ],
    },
    {
      heading: "Cash on Delivery (COD) Orders",
      blocks: [
        { type: "paragraph", text: "For COD orders requiring advance confirmation payment:" },
        {
          type: "list",
          items: [
            "Cancellation before dispatch may be accepted",
            "Any COD confirmation / order booking fee may be non-refundable once order processing has begun",
          ],
        },
      ],
    },
    {
      heading: "Customized / Special Orders",
      blocks: [
        {
          type: "paragraph",
          text: "Customized products, special sourcing products, limited-stock items, pre-order products, or special-request purchases cannot be cancelled once confirmed.",
        },
      ],
    },
    {
      heading: "Cancellation Due to Suspicious Orders",
      blocks: [
        {
          type: "paragraph",
          text: "Little Stepz reserves the right to cancel any order without prior notice in cases such as:",
        },
        {
          type: "list",
          items: [
            "Pricing errors",
            "Product stock unavailability",
            "Fraud detection",
            "Suspicious activity",
            "Unverifiable customer information",
            "High-risk delivery locations",
            "Payment verification issues",
          ],
        },
      ],
    },
    {
      heading: "Refund for Approved Cancellation",
      blocks: [
        { type: "paragraph", text: "If cancellation is approved before dispatch:" },
        {
          type: "list",
          items: [
            "Prepaid orders will be refunded to the original payment method",
            "Refund timelines depend on banking/payment provider processing",
          ],
        },
      ],
    },
    {
      heading: "Customer Support Cancellation Request",
      blocks: [
        { type: "paragraph", text: "To request cancellation, customers must contact support immediately with:" },
        {
          type: "list",
          items: ["Order Number", "Registered Phone Number", "Order Details"],
        },
        {
          type: "paragraph",
          text: "Little Stepz cannot guarantee cancellation once order processing begins.",
        },
      ],
    },
  ],
};
