"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import clsx from "clsx"
import { useCategoryStore } from "../../../store/useCategoryStore"

interface Props {
  value?: string
  onChange: (id: string) => void
}

export default function CategoryTreeSelect({ value, onChange }: Props) {
  const { tree, fetchTree } = useCategoryStore()

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | undefined>(value)

  useEffect(() => {
    if (!tree.length) fetchTree()
  }, [tree.length, fetchTree])

  useEffect(() => {
    setSelected(value)
  }, [value])

  const toggle = (id: string) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }))
  }

  const select = (id: string) => {
    setSelected(id)
    onChange(id)
  }

  const renderNodes = (nodes: any[], depth = 0) =>
    nodes.map((node) => {
      const isOpen = expanded[node.id]
      const isSelected = selected === node.id

      return (
        <div key={node.id}>
          <div
            className={clsx(
              "flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-100",
              isSelected && "bg-primary/10 text-primary font-medium"
            )}
            style={{ paddingLeft: depth * 16 }}
          >
            {node.children?.length ? (
              <button
                type="button"
                onClick={() => toggle(node.id)}
                className="p-0.5"
              >
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <div className="w-4" />
            )}

            <span
              className="flex-1"
              onClick={() => select(node.id)}
            >
              {node.name}
            </span>
          </div>

          {isOpen && node.children?.length > 0 && (
            <div>{renderNodes(node.children, depth + 1)}</div>
          )}
        </div>
      )
    })

  return (
    <div className="border rounded-lg max-h-80 overflow-y-auto p-2 bg-white">
      {tree.length ? (
        renderNodes(tree)
      ) : (
        <p className="text-sm text-muted p-2">Loading categories…</p>
      )}
    </div>
  )
}