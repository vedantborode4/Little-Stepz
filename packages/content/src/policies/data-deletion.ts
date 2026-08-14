import type { PolicyPage } from "../types";

export const dataDeletion: PolicyPage = {
  slug: "data-deletion",
  title: "Account & Data Deletion",
  intro:
    "This page explains how to request deletion of your Little Stepz account and the personal data associated with it, what gets deleted, and what we are required to keep.",
  sections: [
    {
      heading: "How to request deletion",
      blocks: [
        {
          type: "paragraph",
          text: "Email support@littlestepz.in from the email address registered on your Little Stepz account, using the subject line \"Account deletion request\".",
        },
        {
          type: "list",
          items: [
            "Send the request from your registered email address so we can confirm it is you",
            "Include the mobile number on your account, if you added one",
            "We may ask you to confirm a recent order before we proceed",
            "We complete verified requests within 30 days and email you once it is done",
          ],
        },
        {
          type: "paragraph",
          text: "You do not need the app installed to make this request. There is no charge, and you can ask us to cancel the request at any time before it is completed.",
        },
      ],
    },
    {
      heading: "What is deleted",
      blocks: [
        {
          type: "paragraph",
          text: "Once your request is verified, we permanently delete:",
        },
        {
          type: "list",
          items: [
            "Your name, email address and mobile number",
            "All saved delivery addresses",
            "Your cart and wishlist",
            "Reviews you have written and any photos you uploaded with them",
            "Your profile picture",
            "Push notification device tokens and notification preferences",
            "Any linked Google or Apple sign-in connection",
            "All saved sign-in sessions, which signs you out on every device",
            "Your affiliate profile and referral code, if you have one",
          ],
        },
      ],
    },
    {
      heading: "What is kept, and for how long",
      blocks: [
        {
          type: "paragraph",
          text: "Indian tax and accounting law requires us to keep records of completed transactions, so we cannot delete these on request:",
        },
        {
          type: "list",
          items: [
            "Order, invoice, payment and refund records — kept for up to 8 years from the end of the relevant financial year",
            "Affiliate commission and payout records, for the same period",
            "Records we are required to retain to resolve a dispute, prevent fraud, or comply with a legal obligation",
          ],
        },
        {
          type: "paragraph",
          text: "Wherever possible these records are separated from your profile so they are no longer linked to you by name, email or phone number. Once the retention period ends, they are permanently deleted.",
        },
      ],
    },
    {
      heading: "Deleting some data without closing your account",
      blocks: [
        {
          type: "paragraph",
          text: "You do not have to delete your whole account to remove specific information. Email support@littlestepz.in and tell us what you would like removed — for example a review you have written, a photo you uploaded, or a saved delivery address. We handle these the same way, within 30 days.",
        },
      ],
    },
    {
      heading: "Questions",
      blocks: [
        {
          type: "paragraph",
          text: "For anything about this process, or about how we handle your personal data more generally, contact support@littlestepz.in. Our Privacy Policy explains what we collect and why.",
        },
      ],
    },
  ],
};
