"use client"

import clsx from "clsx"
import Link from "next/link"
import { usePathname } from "next/navigation"

/** Route-based tabs; scrolls horizontally on phones instead of wrapping. */
export default function LinkTabs({ tabs }: { tabs: { label: string; href: string }[] }) {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-border mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-muted hover:text-text",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
