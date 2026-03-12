"use client"

import { useState } from "react"
import CheckoutAddressSection from "../address/CheckoutAddressSection"
import OrderReview from "./OrderReview"
import PaymentSection from "./PaymentSection"
import { useAddressStore } from "../../store/useAddressStore"
import { CheckCircle, MapPin, ShoppingBag, CreditCard } from "lucide-react"

interface Props {
  onStepChange?: (step: number) => void
}

export default function CheckoutStepper({ onStepChange }: Props) {
  const [step, setStep] = useState(1)

  const goToStep = (n: number) => {
    setStep(n)
    onStepChange?.(n)
  }

  const handleAddressContinue = () => goToStep(2)

  const stepMeta = [
    { num: 1, label: "Address", icon: MapPin },
    { num: 2, label: "Review", icon: ShoppingBag },
    { num: 3, label: "Payment", icon: CreditCard },
  ]

  return (
    <div className="space-y-4">
      {/* Step progress bar */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card flex items-center">
        {stepMeta.map(({ num, label, icon: Icon }, idx) => {
          const done = step > num
          const active = step === num
          return (
            <div key={num} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 min-w-[64px]">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                    done
                      ? "bg-green-500 text-white shadow-sm"
                      : active
                      ? "bg-primary text-white ring-4 ring-primary/20 shadow-sm"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {done ? <CheckCircle size={17} /> : <Icon size={15} />}
                </div>
                <span
                  className={`text-[11px] font-semibold whitespace-nowrap ${
                    active ? "text-primary" : done ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {idx < stepMeta.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all duration-300 ${
                    step > num ? "bg-green-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1 — Address */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-card overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2.5">
            <span
              className={`w-6 h-6 rounded-full text-[11px] flex items-center justify-center font-bold ${
                step > 1 ? "bg-green-500 text-white" : "bg-primary text-white"
              }`}
            >
              {step > 1 ? "✓" : "1"}
            </span>
            Delivery Address
          </h2>
          {step > 1 && (
            <button
              onClick={() => goToStep(1)}
              className="text-primary text-sm font-semibold hover:underline"
            >
              Change
            </button>
          )}
        </div>
        <div className="p-6">
          {step === 1 && <CheckoutAddressSection onContinue={handleAddressContinue} />}
          {step > 1 && <AddressConfirmed />}
        </div>
      </div>

      {/* Step 2 — Review */}
      {step >= 2 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-card overflow-hidden">
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2.5">
              <span
                className={`w-6 h-6 rounded-full text-[11px] flex items-center justify-center font-bold ${
                  step > 2 ? "bg-green-500 text-white" : "bg-primary text-white"
                }`}
              >
                {step > 2 ? "✓" : "2"}
              </span>
              Order Review
            </h2>
            {step > 2 && (
              <button
                onClick={() => goToStep(2)}
                className="text-primary text-sm font-semibold hover:underline"
              >
                Change
              </button>
            )}
          </div>
          <div className="p-6">
            <OrderReview />
            {step === 2 && (
              <button
                onClick={() => goToStep(3)}
                className="mt-5 w-full bg-primary text-white py-3.5 rounded-xl font-semibold hover:opacity-90 transition shadow-sm"
              >
                Continue to Payment
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3 — Payment */}
      {step >= 3 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full text-[11px] flex items-center justify-center font-bold bg-primary text-white">
                3
              </span>
              Payment Method
            </h2>
          </div>
          <div className="p-6">
            <PaymentSection />
          </div>
        </div>
      )}
    </div>
  )
}

function AddressConfirmed() {
  const addresses = useAddressStore((s) => s.addresses)
  const selectedId = useAddressStore((s) => s.selectedAddressId)
  const addr = addresses.find((a: any) => a.id === selectedId)

  if (!addr) {
    return (
      <p className="text-sm text-gray-500 flex items-center gap-1.5">
        <CheckCircle size={14} className="text-green-500" /> Address selected
      </p>
    )
  }

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-start gap-3">
      <CheckCircle size={15} className="text-green-500 mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold text-gray-900">{addr.name ?? addr.fullName}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {[addr.line1 ?? addr.address, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
        </p>
      </div>
    </div>
  )
}
