import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";

const baseCategorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type CategoryTree = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  children: CategoryTree[];
};

export async function getCategoriesService() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: baseCategorySelect,
  });
}

export async function getCategoryTreeService(): Promise<CategoryTree[]> {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: baseCategorySelect,
  });

  const allIds = new Set(categories.map((c) => c.id));

  // Map parentId => children
  const map = new Map<string | null, CategoryTree[]>();
  for (const cat of categories) {
    const key = cat.parentId && allIds.has(cat.parentId) ? cat.parentId : null;

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ ...cat, children: [] });
  }

  function buildTree(parentId: string | null = null, path = new Set<string>()): CategoryTree[] {
    return (map.get(parentId) || []).map((node) => {
      if (path.has(node.id)) {
        console.error(`Category cycle detected at id=${node.id}. Skipping children.`);
        return { ...node, children: [] }; 
      }

      path.add(node.id);
      const children = buildTree(node.id, path);
      path.delete(node.id);

      return { ...node, children };
    });
  }

  return buildTree();
}

export async function getCategoryBySlugService(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: baseCategorySelect,
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return category;
}
