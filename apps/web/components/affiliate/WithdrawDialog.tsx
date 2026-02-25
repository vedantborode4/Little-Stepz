"use client"

import { useState } from "react"
import { AffiliateService } from "../../lib/services/affiliate.service"
import { toast } from "sonner"

export default function WithdrawDialog({
  balance,
}: {
  balance: number
}) {
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const withdraw = async () => {
    const value = Number(amount)

    if (!value) return toast.error("Enter amount")

    if (value > balance)
      return toast.error("Amount exceeds balance")

    try {
      setLoading(true)
      await AffiliateService.withdraw(value)

      toast.success("Withdrawal requested 🎉")
      setAmount("")
    } catch {
      toast.error("Withdrawal failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">

      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Enter amount"
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />

      <button
        onClick={withdraw}
        disabled={loading}
        className="w-full bg-primary text-white py-2 rounded-lg text-sm"
      >
        {loading ? "Processing…" : "Withdraw"}
      </button>

    </div>
  )
}