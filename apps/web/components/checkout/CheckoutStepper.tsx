"use client"

import { useState } from "react"
import CheckoutAddressSection from "../address/CheckoutAddressSection"
import OrderReview from "./OrderReview"

export default function CheckoutStepper() {
  const [step, setStep] = useState(1)

  return (
    <div className="space-y-6">

      {/* STEP 1 — ADDRESS */}
      <div className="bg-white border rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">
            1. Delivery Address
          </h2>

          {step > 1 && (
            <button
              onClick={() => setStep(1)}
              className="text-primary text-sm"
            >
              Change
            </button>
          )}
        </div>

        {step === 1 && (
          <CheckoutAddressSection onContinue={() => setStep(2)} />
        )}
      </div>

      {/* STEP 2 — REVIEW */}
      {step >= 2 && (
        <div className="bg-white border rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">
            2. Order Review
          </h2>

          <OrderReview />
        </div>
      )}
    </div>
  )
}
