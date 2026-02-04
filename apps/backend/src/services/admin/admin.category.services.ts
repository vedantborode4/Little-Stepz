import { prisma } from "@repo/db/client";
import { CreateCategoryData, UpdateCategoryData } from "@repo/zod-schema/index";
import { ApiError } from "../../utils/api";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
};

async function checkSlugUnique(slug: string, ignoreId?: string) {
  const existing = await prisma.category.findFirst({
    where: { slug, ...(ignoreId && { NOT: { id: ignoreId } }) },
  });
  if (existing) throw new ApiError(400, "Slug must be unique");
}

async function validateParentId(parentId?: string, currentId?: string) {
  if (!parentId) return;
  if (parentId === currentId) throw new ApiError(400, "Category cannot be its own parent");

  let parent = await prisma.category.findUnique({ where: { id: parentId } });
  while (parent) {
    if (parent.id === currentId) throw new ApiError(400, "Circular category relationship detected");
    parent = parent.parentId ? await prisma.category.findUnique({ where: { id: parent.parentId } }) : null;
  }
}

export async function createCategoryService(data: CreateCategoryData) {
  await validateParentId(data.parentId);
  await checkSlugUnique(data.slug);

  return prisma.category.create({
    data,
    select: categorySelect,
  });
}

export async function updateCategoryService(id: string, data: UpdateCategoryData) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new ApiError(404, "Category not found");

  await validateParentId(data.parentId, id);

  if (data.slug && data.slug !== category.slug) {
    await checkSlugUnique(data.slug, id);
  }

  return prisma.category.update({
    where: { id },
    data,
    select: categorySelect,
  });
}

export async function deleteCategoryService(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new ApiError(404, "Category not found");

  const hasChildren = await prisma.category.findFirst({ where: { parentId: id } });
  if (hasChildren) throw new ApiError(400, "Cannot delete category with child categories");

  await prisma.category.delete({ where: { id } });
}
