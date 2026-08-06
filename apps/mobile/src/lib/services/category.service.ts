import { api } from "../api/client";

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  parentId?: string | null;
  children?: CategoryNode[];
}

// /categories/tree returns 404 on the backend — fetch flat /categories and build client-side.
function buildTree(flat: CategoryNode[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];
  for (const cat of flat) map.set(cat.id, { ...cat, children: [] });
  for (const cat of map.values()) {
    if (cat.parentId) {
      const parent = map.get(cat.parentId);
      if (parent) parent.children!.push(cat);
      else roots.push(cat);
    } else {
      roots.push(cat);
    }
  }
  return roots;
}

export const CategoryService = {
  getTree: async (): Promise<CategoryNode[]> => {
    const res = await api.get("/categories");
    return buildTree(res.data.data);
  },
  getAll: async (): Promise<CategoryNode[]> => {
    const res = await api.get("/categories");
    return res.data.data;
  },
};
