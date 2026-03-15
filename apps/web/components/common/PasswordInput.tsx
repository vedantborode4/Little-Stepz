"use client"

import { forwardRef, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string
}

// forwardRef so react-hook-form's register() works seamlessly
const PasswordInput = forwardRef<HTMLInputElement, Props>(
  ({ placeholder = "Password", className = "", ...props }, ref) => {
    const [show, setShow] = useState(false)

    return (
      <div className="relative w-full">
        <input
          {...props}
          ref={ref}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          className={`w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition bg-white ${className}`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((p) => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"
export default PasswordInput