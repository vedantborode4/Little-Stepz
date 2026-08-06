/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@repo/ui"],
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
