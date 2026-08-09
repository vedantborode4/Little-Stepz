# Little Stepz — Mobile App

React Native (Expo SDK 54, expo-router v6) app mirroring the Little Stepz website (`apps/web`). Runs in **Expo Go** — no custom native modules.

## Stack
- **expo-router** file-based routing · **NativeWind** (Tailwind v3) styling with the web's design tokens
- **Zustand** (auth, cart, checkout, wishlist, filters) · **TanStack Query** (server data)
- **axios** client with Bearer access token (expo-secure-store) + cookie-based refresh
- **react-native-webview** for Razorpay checkout · **react-native-svg** for admin charts
- Shared validation from `@repo/zod-schema`

## Running (dev)
The backend (`apps/backend`) must run on the LAN, not just localhost, so a physical device can reach it:

1. Build the shared schema once: `pnpm --filter @repo/zod-schema build`
2. Start the backend bound to `0.0.0.0:8000` (allow it through Windows Firewall).
3. Point the app at your machine's LAN IP — either:
   - create `apps/mobile/.env` with `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000/api/v1`, or
   - rely on auto-derive (it reads the Metro host and targets `:8000`).

   Optional (live chat): add `EXPO_PUBLIC_TAWK_PROPERTY_ID` and `EXPO_PUBLIC_TAWK_WIDGET_ID`
   (public embed IDs from the tawk.to dashboard). Without them, the "Chat with us" screen
   shows an unavailable message instead of the widget.
4. Start Metro: `cd apps/mobile && npx expo start` (add `EXPO_OFFLINE=1` if behind a restrictive network; `--tunnel` if the LAN is blocked).
5. Scan the QR with **Expo Go**.

## Structure (`src/`)
- `app/` — routes: `(auth)`, `(tabs)` [home, search, cart, wishlist, account], `product/[slug]`,
  `category/[slug]`, `checkout` (+ `payment` WebView, `success`), `orders`, `address`, `profile`,
  `affiliate/*`, `admin/*`
- `components/ui` — Button, Input, Card, Badge, StatusBadge, Sheet, SelectSheet, PagedList, StatCard, etc.
- `components/{product,cart,home,order,address,layout}` — domain components
- `features/affiliate`, `features/admin` — panel services + components
- `lib/api` — axios client, token (SecureStore), query-client · `lib/services` — API services (ported from web)
- `store/` — Zustand stores · `theme/` — tokens/shadows · `lib/enums.ts` — status→label/color maps

## Notes / known constraints
- **Auth refresh** relies on the native cookie jar (no backend change). Access token is in SecureStore;
  if the refresh cookie is dropped on cold start the user re-logs in.
- **Payments**: Razorpay runs in a WebView (`app/checkout/payment.tsx`) so the app stays Expo Go-compatible.
- **Admin order detail** has no GET-by-id endpoint → it's seeded from the list tap (`features/admin/store.ts`).
- **Coupons** use type `"FLAT"` (matching the web/backend), not `"FIXED_AMOUNT"`.
- `reactCompiler` is disabled in `app.json` (it conflicted with NativeWind on first bring-up).
