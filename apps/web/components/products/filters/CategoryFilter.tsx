"use client"

import { useEffect } from "react"
import { useCategoryStore } from "../../../store/useCategoryStore"
import CategoryTreeNode from "./CategoryTreeNode"

export default function CategoryFilter() {
  const { tree, fetchTree, isLoading } = useCategoryStore()

  useEffect(() => {
    if (!tree.length) fetchTree()
  }, [tree.length, fetchTree])

  if (isLoading) return <p className="text-sm">Loading...</p>

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-text">Categories</h3>

      {tree.map((node) => (
        <CategoryTreeNode key={node.id} node={node} />
      ))}
    </div>
  )
}
