"use client"

import { useState } from "react"
import CheckoutAddressSection from "../address/CheckoutAddressSection"
import OrderReview from "./OrderReview"
import PaymentSection from "./PaymentSection"
import { useAddressStore } from "../../store/useAddressStore"

interface Props {
  onAddressChange?: (id: string) => void
}

export default function CheckoutStepper({ onAddressChange }: Props) {
  const [step, setStep] = useState(1)

  const handleAddressContinue = () => {
    // Also notify parent with the currently selected address
    const selectedId = useAddressStore.getState().selectedAddressId
    if (selectedId && onAddressChange) {
      onAddressChange(selectedId)
    }
    setStep(2)
  }

  return (
    <div className="space-y-6">

      {/* Step 1 — Address */}
      <div className="bg-white border rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">1. Delivery Address</h2>
          {step > 1 && (
            <button
              onClick={() => setStep(1)}
              className="text-primary text-sm font-medium"
            >
              Change
            </button>
          )}
        </div>

        {step === 1 && (
          <CheckoutAddressSection onContinue={handleAddressContinue} />
        )}

        {step > 1 && (
          <AddressConfirmed />
        )}
      </div>

      {/* Step 2 — Order Review */}
      {step >= 2 && (
        <div className="bg-white border rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">2. Order Review</h2>
            {step > 2 && (
              <button
                onClick={() => setStep(2)}
                className="text-primary text-sm font-medium"
              >
                Change
              </button>
            )}
          </div>

          <OrderReview />

          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              className="mt-6 w-full bg-primary text-white py-3 rounded-xl font-medium hover:opacity-90 transition"
            >
              Continue to Payment
            </button>
          )}
        </div>
      )}

      {/* Step 3 — Payment */}
      {step === 3 && (
        <div className="bg-white border rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">3. Payment</h2>
            <button
              onClick={() => setStep(2)}
              className="text-primary text-sm font-medium"
            >
              Change
            </button>
          </div>

          <PaymentSection />
        </div>
      )}
    </div>
  )
}

// Small component to show confirmed address summary
function AddressConfirmed() {
  const id = useAddressStore((s) => s.selectedAddressId)
  if (!id) return null
  return (
    <p className="text-sm text-gray-500">Address selected ✓</p>
  )
}
