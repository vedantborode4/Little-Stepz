"use client"

import { useState } from "react"
import { Button, Input } from "@repo/ui/index"
import { AdminOrderService } from "../../../lib/services/admin-order.service"

export default function ResolveReturnModal({ returnId, refresh }: any) {
  const [note, setNote] = useState("")

  const resolve = async (status: "APPROVED" | "REJECTED") => {
    await AdminOrderService.resolveReturn(returnId, {
      status,
      adminNote: note,
    })
    refresh()
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Admin note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="flex gap-2">
        <Button className="bg-green-600" onClick={() => resolve("APPROVED")}>
          Approve
        </Button>
        <Button className="bg-red-600" onClick={() => resolve("REJECTED")}>
          Reject
        </Button>
      </div>
    </div>
  )
}