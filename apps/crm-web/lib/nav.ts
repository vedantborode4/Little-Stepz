import type { Permission } from "@repo/crm-schema"
import {
  BarChart3, Boxes, Calculator, CalendarClock, ClipboardCheck, CreditCard, FileSpreadsheet, History,
  LayoutDashboard, Package, Receipt, RotateCcw, Settings, ShoppingBag, ShoppingCart, Tags, Truck, Users, Wallet,
  type LucideIcon,
} from "lucide-react"

/** Highest phase whose modules are live. Bump as each phase ships. */
export const SHIPPED_PHASE = 1

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  permission: Permission
  phase: number
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const dashboardItem: NavItem = { label: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard.view", phase: 1 }

export const navSections: NavSection[] = [
  {
    title: "Sell",
    items: [
      { label: "POS", href: "/pos", icon: ShoppingCart, permission: "sales.create", phase: 6 },
      { label: "Sales Orders", href: "/sales", icon: ShoppingBag, permission: "sales.view", phase: 6 },
      { label: "Pre-orders", href: "/pre-orders", icon: CalendarClock, permission: "sales.view", phase: 8 },
      { label: "Customers", href: "/customers", icon: Users, permission: "customers.view", phase: 5 },
      { label: "Payments", href: "/payments", icon: CreditCard, permission: "payments.view", phase: 7 },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", href: "/products", icon: Package, permission: "products.view", phase: 2 },
      { label: "Variant Mapping", href: "/variants", icon: Tags, permission: "products.manage", phase: 2 },
    ],
  },
  {
    title: "Stock",
    items: [
      { label: "Inventory", href: "/inventory", icon: Boxes, permission: "inventory.view", phase: 3 },
      { label: "Purchases", href: "/purchases", icon: Receipt, permission: "purchases.view", phase: 4 },
      { label: "Stock Counts", href: "/stock-counts", icon: ClipboardCheck, permission: "stockcount.perform", phase: 12 },
    ],
  },
  {
    title: "Fulfilment",
    items: [
      { label: "Shipping", href: "/shipping", icon: Truck, permission: "shipping.manage", phase: 10 },
      { label: "Returns", href: "/returns", icon: RotateCcw, permission: "sales.view", phase: 9 },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Cash Closing", href: "/cash", icon: Calculator, permission: "cash.close", phase: 11 },
      { label: "Expenses", href: "/expenses", icon: Wallet, permission: "expenses.manage", phase: 11 },
      { label: "Profit & Analytics", href: "/analytics", icon: BarChart3, permission: "reports.financial", phase: 13 },
      { label: "Reports", href: "/reports", icon: FileSpreadsheet, permission: "reports.view", phase: 13 },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Settings", href: "/settings", icon: Settings, permission: "settings.manage", phase: 1 },
      { label: "Audit History", href: "/audit", icon: History, permission: "audit.view", phase: 1 },
    ],
  },
]

export const allNavItems = [dashboardItem, ...navSections.flatMap((s) => s.items)]

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}
