"use client"

import { useState, memo } from "react"
import { ChevronDown } from "lucide-react"
import { CategoryNode } from "../../../lib/services/category.service"
import { useRouter, usePathname } from "next/navigation"
import clsx from "clsx"

interface Props {
  node: CategoryNode
}

function CategoryTreeNode({ node }: Props) {
  const [open, setOpen] = useState(false)

  const router = useRouter()
  const pathname = usePathname()

  const isActive = pathname === `/products/category/${node.slug}`

  const handleCategoryClick = () => {
    // Navigate straight to the category page — the category route drives the
    // fetch by its slug, so we must NOT also poke the filter store here (doing
    // so made the All Products page fire a competing URL update and left it
    // stuck on an empty, filtered state).
    router.push(`/products/category/${node.slug}`)
  }

  return (
    <div className="space-y-1">
      <div
        className={clsx(
          "flex items-center justify-between cursor-pointer text-sm group",
          isActive && "text-primary font-semibold"
        )}
      >
        <span
          onClick={handleCategoryClick}
          className="flex-1 hover:text-primary transition"
        >
          {node.name}
        </span>

        {node.children?.length ? (
          <ChevronDown
            onClick={() => setOpen(!open)}
            className={clsx(
              "w-4 h-4 transition group-hover:text-primary",
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
