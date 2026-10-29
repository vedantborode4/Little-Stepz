/* global process */
/**
 * The browser only ever talks to this origin: /api/* is proxied to crm-api, so
 * the refresh cookie is first-party and no CORS is needed in the browser.
 * @type {import('next').NextConfig}
 */
const apiOrigin = process.env.CRM_API_ORIGIN ?? "http://localhost:8100";

const nextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@repo/crm-schema"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
