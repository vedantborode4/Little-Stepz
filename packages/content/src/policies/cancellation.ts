import type { PolicyPage } from "../types";
import { REFUND_WORKING_DAYS } from "../refunds";

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
            `Prepaid orders will be refunded to the original payment method, and the refund will be initiated within ${REFUND_WORKING_DAYS} working days`,
            "Once initiated, the time it takes to appear on your statement depends on your bank or payment provider",
            "On a Partial Payment order the deposit is not refunded — see below. Any amount collected beyond the deposit is returned in full",
          ],
        },
      ],
    },
    {
      heading: "Partial Payment Orders and Refused Delivery",
      blocks: [
        { type: "paragraph", text: "On an order placed under our Partial Payment plan, the deposit paid at checkout is non-refundable. It is retained in full if you cancel the order after paying it, refuse delivery, or are unavailable to accept the parcel." },
        { type: "paragraph", text: "This is because the deposit secures the order and covers the cost of preparing and shipping it. The term is shown at checkout and must be acknowledged before the order can be placed, and it is shown again before you confirm a cancellation." },
        { type: "paragraph", text: "Any amount you paid beyond the deposit is refunded in full. Where Little Stepz cancels the order for its own reasons — including an inability to fulfil it — the deposit is refunded as well. Return shipping costs may be recovered on a refused delivery." },
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
