# Dark Mode — apps/web

Full-coverage dark mode (storefront + account + admin + affiliate), OS-default with a
persisted manual toggle, no flash on load. Tailwind v4 + Next 16 App Router.

## Approach

The app hardcodes light colors (`bg-white`, `text-gray-*`, `border-gray-*`) in ~1474 places
across 132 files. Rather than bolt `dark:` onto every one, we convert to **semantic tokens
that flip at runtime**. Tokens already partly exist (`bg-bg`, `text-text`, `text-muted`,
`border-border`, used ~396×); we extend the set and redefine it under `.dark`.

### Token system (globals.css)
- `@custom-variant dark` (class-based, driven by next-themes `class="dark"` on `<html>`).
- `:root` = light values, `.dark` = dark values, mapped via `@theme inline` so utilities
  like `bg-surface` / `text-text` resolve to the live CSS var and flip automatically.
- Tokens: `bg`, `surface`, `surface-2`, `surface-3`, `text`, `muted`, `faint`, `border`,
  `primary`, `secondary`, plus `--shadow-card`.
- `body` gets `bg-bg` / `text-text` as the base so uncovered areas flip too.

### Conversion rulebook (applied everywhere)
- `bg-white`→`bg-surface`; `bg-gray-50|100`→`bg-surface-2`; `bg-gray-200`(incl hover)→`bg-surface-3`
- `text-gray-900|800`/`text-black`→`text-text`; `text-gray-700|600|500`→`text-muted`; `text-gray-400|300`→`text-faint`
- `border-gray-50|100|200|300`→`border-border`
- Pale status fills: `bg-{hue}-50`→ add `dark:bg-{hue}-950/40`; `bg-{hue}-100`→ add `dark:bg-{hue}-900/40` (keep the text color)
- Keep untouched: `bg-primary`, `text-primary`, `text-white` on colored buttons, `bg-black/xx` overlays, brand gradients.

## Tasks
- [x] Install `next-themes` in apps/web
- [x] Refactor `app/globals.css` to token/`.dark` system
- [x] Add `ThemeProvider` (next-themes) + wire into `app/layout.tsx` (`suppressHydrationWarning`, base bg/text)
- [x] Build `ThemeToggle` component (sun/moon, hydration-safe) + theme-aware `ThemedToaster`
- [x] Place toggle in storefront Navbar, admin mobile topbar + sidebar, affiliate topbar
- [x] Convert Navbar (chrome + status pills); leave Footer (intentionally dark both themes)
- [x] Sweep all components via deterministic scripts (gray→token, bg-white→surface, colored→dark variants)
- [x] `pnpm --filter web check-types` clean
- [x] Verify compiled CSS: tokens flip, `.dark` variants + surface utilities generated, no-flash script injected
- [ ] Human visual QA in browser (see Review notes)

## Review

**What shipped**
- **Token system** (`globals.css`): `@custom-variant dark`, `:root`/`.dark` value blocks mapped through
  `@theme inline`. Tokens: `bg, surface, surface-2, surface-3, text, muted, faint, border, primary, secondary`
  + `--shadow-card`. `body` uses `bg` / `text` as the base so uncovered areas flip too.
- **Provider/toggle**: `app/providers/theme-provider.tsx` (next-themes, system default, persisted, no-flash),
  `components/common/ThemeToggle.tsx` (hydration-safe sun/moon), `components/common/ThemedToaster.tsx`.
  Toggle placed in storefront Navbar, admin sidebar + mobile topbar, affiliate topbar.
- **Component sweep** (scripted, deterministic — ~130 files):
  - grays: `text-gray-*`→`text-text|muted|faint`, `bg-gray-50/100`→`surface-2`, `bg-gray-200/300`→`surface-3`,
    `border-gray-*`→`border`, `divide-gray-100`→`divide-border`.
  - `bg-white` (opaque)→`bg-surface`; translucent `bg-white/xx` glass overlays on images/hero left as-is.
  - Chromatic status chips/text/borders got `dark:` variants (e.g. `bg-green-50 dark:bg-green-500/15`,
    `text-red-600 dark:text-red-400`).
  - Fixes: empty star fill, admin drawer scrim → `bg-black/50`, filter sidebar hex → `bg-surface-2`.
- **Intentionally untouched**: Footer (permanently dark), `text-white`/`bg-black/xx` overlays, brand gradients,
  `via-white` shimmer, a few mid-gray placeholders/hover borders that read fine in both themes.

**Verified**: typecheck clean; compiled dev CSS shows both light+dark token values, the `:where(.dark, .dark *)`
variant rules, generated surface utilities, and the injected no-flash script; homepage 200.

**Needs eyeballs (headless can't verify visuals)** — all tunable centrally in the `.dark` block:
- Dark elevation: `surface` (cards) is darker than `surface-2` (subtle panels). For white-cards-on-gray-section
  layouts the card sits slightly darker than its band. Looks fine for modals/inputs; if cards should pop more,
  bump `--color-surface` lighter than `--color-surface-2` in the `.dark` block.

## Second pass — per-component contrast audit (7 parallel agents, disjoint scopes)

Fixed the contrast bugs the scripted sweep couldn't catch by reasoning:
- **Glass-over-content chips** (light bg + now-light token text): ProductCard wishlist/share, ProductGallery
  zoom/badge, HeroFallback badge → `bg-white/NN`→`bg-surface/NN` (dark glass in dark, identical in light).
- **Hero controls over banner imagery** (must NOT vanish): DynamicHeroBanner / MobileHeroBanner / HeroCarousel
  arrows + active dots kept **light** (`bg-white`) with **fixed-dark icons** (`text-gray-700`) in both themes.
- **`.ts` files** (missed by the `.tsx`-only scripts): `admin/orders/orderStatusMeta.ts` — 13 order-status badges
  had light-only classes → added `dark:` variants.
- **Form placeholders**: `placeholder-gray-400`→`placeholder:text-faint` (address dialogs, review form).
- **Dark-on-dark hover text**: affiliate ReferralLinkCard share buttons, apply-page error ring → dark variants.
- **Opaque white ring**: ProfileCard avatar `border-white`→`border-surface`.
- Everything else (cart, checkout, orders, admin tables/modals, affiliate dashboard, reviews, policy, auth)
  audited and confirmed already correct.

**Verified**: `check-types` clean; compiled dev CSS confirms new utilities generated
(`placeholder:text-faint`, `bg-surface/90`, `dark:hover:border-green-500/40`, `dark:bg-blue-500/20`);
391 dark-variant rules in the served stylesheet.
