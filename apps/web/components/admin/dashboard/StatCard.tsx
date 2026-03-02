import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface Props {
  title: string
  value: string | number
  prefix?: string
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  color?: string
}

export default function StatCard({
  title,
  value,
  prefix = "",
  change,
  changeLabel = "vs last month",
  icon,
  color = "bg-primary/10 text-primary",
}: Props) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        {icon && (
          <div className={`p-2 rounded-xl ${color}`}>
            {icon}
          </div>
        )}
        <button className="text-gray-400 hover:text-gray-600 ml-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {prefix}{typeof value === "number" ? value.toLocaleString() : value}
      </h2>

      {change !== undefined && (
        <div className="flex items-center gap-1.5">
          <span
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPositive
                ? "bg-green-50 text-green-600"
                : isNegative
                ? "bg-red-50 text-red-500"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {isPositive ? (
              <TrendingUp size={10} />
            ) : isNegative ? (
              <TrendingDown size={10} />
            ) : (
              <Minus size={10} />
            )}
            {Math.abs(change)}%
          </span>
          <span className="text-xs text-gray-400">{changeLabel}</span>
        </div>
      )}
    </div>
  )
}
