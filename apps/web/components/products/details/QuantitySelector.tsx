"use client"

import { useState } from "react"

export default function QuantitySelector() {
  const [qty, setQty] = useState(1)

  return (
    <div className="flex items-center border rounded-lg w-fit">

      <button onClick={() => setQty(qty > 1 ? qty - 1 : 1)} className="px-4 py-2">-</button>

      <span className="px-4">{qty}</span>

      <button onClick={() => setQty(qty + 1)} className="px-4 py-2">+</button>

    </div>
  )
}
