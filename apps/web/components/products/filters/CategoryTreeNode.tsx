"use client"

import { useState, memo } from "react"
import { ChevronDown } from "lucide-react"
import { CategoryNode } from "../../../lib/services/category.service"
import { useProductFilterStore } from "../../../store/useProductFilterStore"
import clsx from "clsx"

interface Props {
  node: CategoryNode
}

function CategoryTreeNode({ node }: Props) {
  const [open, setOpen] = useState(false)

  const activeCategory = useProductFilterStore((s) => s.category)
  const setFilters = useProductFilterStore((s) => s.setFilters)

  const isActive = activeCategory === node.slug

  return (
    <div className="space-y-1">

      <div
        className={clsx(
          "flex items-center justify-between cursor-pointer text-sm",
          isActive && "text-primary font-semibold"
        )}
      >
        <span
          onClick={() => setFilters({ category: node.slug })}
          className="flex-1"
        >
          {node.name}
        </span>

        {node.children?.length ? (
          <ChevronDown
            onClick={() => setOpen(!open)}
            className={clsx(
              "w-4 h-4 transition",
              open && "rotate-180"
            )}
          />
        ) : null}
      </div>

      {open && node.children?.length && (
        <div className="pl-4 border-l space-y-1">
          {node.children.map((child) => (
            <CategoryTreeNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(CategoryTreeNode)
