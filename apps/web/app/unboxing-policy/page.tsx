import { PackageOpen } from "lucide-react"
import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Unboxing Policy — Video Proof Rules",
  description:
    "A complete unboxing video is mandatory for any Little Stepz claim related to damage, missing items, incorrect products, or tampered packages.",
  path: "/unboxing-policy",
})

export default function UnboxingPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <PackageOpen size={18} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text">Unboxing Policy</h1>
      </div>
      <p className="text-xs text-faint mb-8">Effective Date: July 10, 2026</p>

      <div className="space-y-6 text-sm text-muted leading-relaxed">
        <p>
          At Little Stepz, every order is carefully inspected, quality checked, securely packed, and
          photographed before dispatch. We are committed to delivering authentic products in perfect
          condition.
        </p>
        <p>
          To ensure a fair and transparent resolution process for both our customers and our team, a
          complete unboxing video is mandatory for any claim related to damage, missing items,
          incorrect products, or tampered packages.
        </p>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-text">Why Do We Require an Unboxing Video?</h2>
          <p>
            Our products travel through multiple logistics partners before reaching you. While we
            pack every shipment with great care, transit-related issues can occasionally occur.
          </p>
          <p>A proper unboxing video allows us to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Verify transit damage</li>
            <li>Confirm missing accessories or items</li>
            <li>Identify incorrect products</li>
            <li>Process replacements much faster</li>
            <li>Protect genuine customers from unnecessary delays</li>
            <li>Support claims with courier partners</li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-text">How to Record the Unboxing Video</h2>
          <ol className="list-decimal pl-5 space-y-2.5">
            <li>
              <span className="font-semibold text-text">Start Before Opening</span> — Begin recording
              before opening the parcel. The sealed package must be clearly visible.
            </li>
            <li>
              <span className="font-semibold text-text">Show All Sides</span> — Slowly show all sides
              of the package, including:
              <ul className="list-disc pl-5 space-y-1.5 mt-1.5">
                <li>Shipping label</li>
                <li>Courier label</li>
                <li>Security tape</li>
                <li>Outer condition of the parcel</li>
              </ul>
            </li>
            <li>
              <span className="font-semibold text-text">Record Continuously</span> — The video must
              be:
              <ul className="list-disc pl-5 space-y-1.5 mt-1.5">
                <li>One continuous recording</li>
                <li>Unedited</li>
                <li>Without pauses</li>
                <li>Without cuts</li>
                <li>Without fast-forwarding</li>
              </ul>
            </li>
            <li>
              <span className="font-semibold text-text">Open the Package on Camera</span> — Open the
              parcel while recording. Ensure the camera clearly captures:
              <ul className="list-disc pl-5 space-y-1.5 mt-1.5">
                <li>Internal packaging</li>
                <li>Bubble wrap</li>
                <li>Protective materials</li>
                <li>Product removal</li>
              </ul>
            </li>
            <li>
              <span className="font-semibold text-text">Show Everything Inside</span> — Display all
              received contents, including:
              <ul className="list-disc pl-5 space-y-1.5 mt-1.5">
                <li>Product</li>
                <li>Accessories</li>
                <li>Manuals</li>
                <li>Charging cables (if applicable)</li>
                <li>Spare parts</li>
                <li>Packaging materials</li>
              </ul>
            </li>
            <li>
              <span className="font-semibold text-text">Show Any Issue Clearly</span> — If you notice:
              <ul className="list-disc pl-5 space-y-1.5 mt-1.5">
                <li>Damage</li>
                <li>Missing items</li>
                <li>Wrong product</li>
                <li>Broken parts</li>
                <li>Manufacturing defects visible on arrival</li>
              </ul>
              <span className="block mt-1.5">please show the issue clearly in the same video.</span>
            </li>
          </ol>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-text">Claims Requiring an Unboxing Video</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Damaged products</li>
            <li>Broken products</li>
            <li>Missing items</li>
            <li>Missing accessories</li>
            <li>Incorrect product received</li>
            <li>Incorrect variant or colour received</li>
            <li>Empty package claims</li>
            <li>Tampered package claims</li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-text">Claims That May Be Rejected</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>No unboxing video is provided</li>
            <li>The video starts after the package has already been opened</li>
            <li>The video has been edited, paused, or cut</li>
            <li>The shipping label is not visible</li>
            <li>The issue is not shown clearly</li>
            <li>The claim is raised after the allowed reporting period</li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-text">Reporting Timeline</h2>
          <p>
            Please report any delivery-related issue within 24 hours of delivery. Include:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Order Number</li>
            <li>Clear description of the issue</li>
            <li>Unboxing video</li>
            <li>Photos of the product (if applicable)</li>
          </ul>
          <p>
            Claims submitted after the reporting period may not be eligible for replacement or
            resolution.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-text">Important Notes</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Please do not discard the original packaging until your issue has been resolved.</li>
            <li>Do not attempt to repair, modify, or use a damaged product before contacting us.</li>
            <li>All claims are subject to verification by the Little Stepz Quality Team.</li>
            <li>
              Replacement, refund, or store credit (where applicable) will be processed only after
              successful verification.
            </li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-lg font-bold text-text">Our Commitment</h2>
          <p>
            At Little Stepz, customer satisfaction is our priority. Every product we sell is sourced
            from trusted suppliers and undergoes quality inspection before dispatch. Our unboxing
            policy helps ensure a fair, transparent, and efficient resolution process whenever an
            issue arises.
          </p>
          <p>
            Thank you for helping us maintain a safe and trustworthy shopping experience for every
            collector and enthusiast.
          </p>
        </section>
      </div>
    </div>
  )
}
