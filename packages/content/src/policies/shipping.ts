import type { PolicyPage } from "../types";

export const shipping: PolicyPage = {
  slug: "shipping",
  title: "Shipping Policy",
  intro:
    "At Little Stepz, we aim to deliver your orders safely, quickly, and efficiently across eligible serviceable locations.",
  sections: [
    {
      heading: "Order Processing Time",
      blocks: [
        {
          type: "list",
          items: [
            "Orders are typically processed within 1–3 business days after successful order confirmation",
            "COD orders may require manual verification before dispatch",
            "Orders placed on weekends, public holidays, or during peak sale periods may require additional processing time",
          ],
        },
      ],
    },
    {
      heading: "Shipping Time",
      blocks: [
        { type: "paragraph", text: "Estimated delivery timelines may vary depending on location:" },
        {
          type: "list",
          items: [
            "Metro Cities: Approximately 2–5 business days",
            "Other Cities / Towns: Approximately 3–7 business days",
            "Remote / Special Service Areas: Delivery timelines may vary depending on courier availability",
          ],
        },
        { type: "paragraph", text: "Delivery timelines are estimates and may vary due to courier operations." },
      ],
    },
    {
      heading: "Shipping Charges",
      blocks: [
        {
          type: "paragraph",
          text: "Little Stepz is currently offering free delivery on all orders, with no minimum order value. This is a promotional offer and we may change or withdraw it at any time.",
        },
        {
          type: "paragraph",
          text: "If the offer ends, shipping charges may vary depending on:",
        },
        {
          type: "list",
          items: [
            "Product size / weight",
            "Delivery location",
            "Courier zone",
            "Promotional offers",
            "Special product categories",
          ],
        },
        {
          type: "paragraph",
          text: "The total you see at checkout is always what you pay — any applicable shipping charge is shown there before you confirm the order, and is never added afterwards.",
        },
      ],
    },
    {
      heading: "Cash on Delivery (COD) Shipping",
      blocks: [
        { type: "paragraph", text: "For selected COD orders:" },
        {
          type: "list",
          items: [
            "Partial advance confirmation fee may be required",
            "COD availability depends on serviceable locations",
            "Little Stepz reserves the right to disable COD for certain locations, products, or customers",
          ],
        },
      ],
    },
    {
      heading: "Delivery Delays",
      blocks: [
        { type: "paragraph", text: "Delivery may be delayed due to:" },
        {
          type: "list",
          items: [
            "Weather conditions",
            "Courier disruptions",
            "Public holidays",
            "Regional restrictions",
            "Operational delays",
            "Natural events beyond control",
            "High seasonal order volume",
          ],
        },
        { type: "paragraph", text: "Such delays are outside Little Stepz's direct control." },
      ],
    },
    {
      heading: "Failed Delivery Attempts",
      blocks: [
        { type: "paragraph", text: "If delivery fails due to:" },
        {
          type: "list",
          items: [
            "Customer unavailable",
            "Incorrect address",
            "Incorrect phone number",
            "Refused delivery",
            "Failure to respond to courier attempts",
          ],
        },
        { type: "paragraph", text: "Additional re-shipping charges may apply." },
      ],
    },
    {
      heading: "Tracking Information",
      blocks: [
        {
          type: "paragraph",
          text: "Once dispatched, tracking details may be shared via email, SMS, WhatsApp, or customer support communication where applicable.",
        },
      ],
    },
    {
      heading: "Shipping Restrictions",
      blocks: [
        {
          type: "paragraph",
          text: "Certain products may not be deliverable to all locations due to courier limitations, product restrictions, battery shipping limitations, or logistics constraints.",
        },
      ],
    },
    {
      heading: "Damaged Delivery",
      blocks: [
        { type: "paragraph", text: "If the package appears visibly damaged upon delivery:" },
        {
          type: "list",
          items: [
            "Customers are strongly advised to record package opening",
            "Mandatory unboxing policy applies for claims",
            "Any issue must be reported within 48 hours",
          ],
        },
      ],
    },
    {
      heading: "International Shipping",
      blocks: [
        {
          type: "paragraph",
          text: "Currently, Little Stepz may or may not offer international shipping depending on operational availability. Customers may contact support for specific requests.",
        },
      ],
    },
    {
      heading: "Right to Modify Shipping Policy",
      blocks: [
        {
          type: "paragraph",
          text: "Little Stepz reserves the right to update shipping timelines, courier partners, shipping charges, or delivery policies without prior notice.",
        },
      ],
    },
  ],
};
