/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@repo/ui"],
    images: {
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
