import OrderStatusBadge from "./OrderStatusBadge"
import OrderActions from "./OrderActions"

export default function OrdersTable({ data, refresh }: any) {
  return (
    <div className="bg-white border rounded-xl">

      <table className="w-full text-sm">
        <thead className="text-gray-500">
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {data.map((o: any) => (
            <tr key={o.id} className="border-t">
              <td>#{o.id.slice(-6)}</td>
              <td>{o.user?.name}</td>
              <td>₹{o.total}</td>
              <td><OrderStatusBadge status={o.status} /></td>
              <td>{new Date(o.createdAt).toLocaleDateString()}</td>
              <td>
                <OrderActions order={o} refresh={refresh} />
              </td>
            </tr>
          ))}
        </tbody>

      </table>
    </div>
  )
}