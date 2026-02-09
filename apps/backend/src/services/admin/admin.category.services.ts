import { prisma } from "@repo/db/client";
import { CreateCategoryData, UpdateCategoryData } from "@repo/zod-schema/index";
import { ApiError } from "../../utils/api";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  deletedAt: true,
};

async function checkSlugUnique(slug: string, ignoreId?: string) {
  const existing = await prisma.category.findFirst({
    where: {
      slug,
      ...(ignoreId && { NOT: { id: ignoreId } }),
    },
  });
  if (existing) throw new ApiError(409, "Slug already in use");
}

async function validateParentId(parentId?: string, currentId?: string) {
  if (!parentId) return;

  if (parentId === currentId) {
    throw new ApiError(400, "Category cannot be its own parent");
  }

  let parent = await prisma.category.findFirst({
    where: {
      id: parentId,
      deletedAt: null, 
    },
  });

  if (!parent) {
    throw new ApiError(400, "Parent category not found");
  }

  while (parent.parentId) {
    if (parent.parentId === currentId) {
      throw new ApiError(400, "Circular category relationship detected");
    }

    parent = await prisma.category.findFirst({
      where: {
        id: parent.parentId,
        deletedAt: null,
      },
    });

    if (!parent) break;
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
  const category = await prisma.category.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  await validateParentId(data.parentId, id);

  if (data.slug !== undefined) {
    if (data.slug.trim() === "") {
      throw new ApiError(400, "Slug cannot be empty");
    }
    if (data.slug !== category.slug) {
      await checkSlugUnique(data.slug, id);
    }
  }

  return prisma.category.update({
    where: { id },
    data,
    select: categorySelect,
  });
}

export async function deleteCategoryService(id: string) {
  const category = await prisma.category.findFirst({
    where: {
      id,
      deletedAt: null, 
    },
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  const hasChildren = await prisma.category.findFirst({
    where: {
      parentId: id,
      deletedAt: null, 
    },
  });

  if (hasChildren) {
    throw new ApiError(400, "Cannot delete category with child categories");
  }

  await prisma.category.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
}
