/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@repo/ui"],
    async rewrites() {
      return [
        // Android fetches this exact path to verify App Links. It must be served
        // from the apex domain over https with no redirect.
        { source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" },
      ];
    },
    images: {
      // Serve modern formats (AVIF first, WebP fallback) and a device-size set
      // tuned for this catalogue's breakpoints (plan W6).
      formats: ["image/avif", "image/webp"],
      deviceSizes: [360, 640, 750, 828, 1080, 1200, 1920, 2048],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      remotePatterns: [
        {
          protocol: "https",
          hostname: "res.cloudinary.com",
        },
        {
          protocol: "https",
          hostname: "picsum.photos",
        },
        {
          protocol: "https",
          hostname: "images.unsplash.com",
        },
      ],
    },
};

export default nextConfig;
