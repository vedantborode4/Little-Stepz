"use client"

import { useState } from "react"
import CheckoutAddressSection from "../address/CheckoutAddressSection"
import OrderReview from "./OrderReview"
import PaymentSection from "./PaymentSection"

export default function CheckoutStepper() {
  const [step, setStep] = useState(1)

  return (
    <div className="space-y-6">

      <div className="bg-white border rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">
            1. Delivery Address
          </h2>

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
          <CheckoutAddressSection
            onContinue={() => {
              // address is already stored in Zustand
              setStep(2)
            }}
          />
        )}
      </div>

      {step >= 2 && (
        <div className="bg-white border rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">
              2. Order Review
            </h2>

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

      {step === 3 && (
        <div className="bg-white border rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">
              3. Payment
            </h2>

            <button
              onClick={() => setStep(2)}
              className="text-primary text-sm font-medium"
            >
              Change
            </button>
          </div>

          <PaymentSection
            onContinue={() => {
              // payment handled inside summary / razorpay
            }}
          />
        </div>
      )}
    </div>
  )
}
