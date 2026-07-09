export default function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-2">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="p-4">
                <div className="h-3 bg-surface-3 rounded animate-pulse w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t border-border">
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="p-4">
                  <div
                    className="h-3 bg-surface-2 rounded animate-pulse"
                    style={{ width: `${60 + Math.random() * 40}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
