/**
 * Brings the top of `el` into view, used after a paginated list swaps its contents —
 * without it the new page renders while the viewport stays scrolled at the old page's
 * footer, so the results look unchanged.
 *
 * The offset that clears the sticky header is CSS, not maths: give the target a
 * `scroll-mt-*` class sized to whatever header sits above it on that surface.
 */
export function scrollToTopOf(el: HTMLElement | null | undefined): void {
  if (!el) return

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })
}
