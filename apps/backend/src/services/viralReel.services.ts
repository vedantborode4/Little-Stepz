import { prisma, Prisma } from "@repo/db/client";
import { baseProductSelect } from "./product.services";
import { withPublicSalePricing } from "../utils/pricing";

// Same visibility rule as the storefront product list.
const visibleProduct: Prisma.ProductWhereInput = {
  deletedAt: null,
  category: { isActive: true },
};

const MAX_PUBLIC_REELS = 50;

export async function getActiveViralReelsService() {
  const reels = await prisma.viralReel.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      products: { some: { product: visibleProduct } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: MAX_PUBLIC_REELS,
    select: {
      id: true,
      reelUrl: true,
      coverImageUrl: true,
      caption: true,
      products: {
        where: { product: visibleProduct },
        orderBy: { sortOrder: "asc" },
        select: { product: { select: baseProductSelect } },
      },
    },
  });

  return {
    reels: reels.map(({ products, ...reel }) => ({
      ...reel,
      products: products.map((p) => withPublicSalePricing(p.product)),
    })),
  };
}
