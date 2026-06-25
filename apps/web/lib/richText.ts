// Shared styling for rendered rich-text HTML, used by both the admin editor preview
// and the storefront render. Kept dependency-free so neither bundle pulls in the other.
export const RICH_TEXT_CLASS =
  "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 " +
  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 " +
  "[&_p]:my-2 [&_p]:leading-relaxed " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 " +
  "[&_li]:my-0.5 [&_strong]:font-semibold"
