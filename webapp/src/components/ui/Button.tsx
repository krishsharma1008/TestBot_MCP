'use client'

import { motion } from 'framer-motion'
import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
}

const variantClasses: Record<Variant, string> = {
  primary:
    'text-black font-bold bg-white border-2 border-black ' +
    'shadow-[3px_3px_0px_#555] hover:shadow-[5px_5px_0px_#555] ' +
    'uppercase tracking-widest font-mono ' +
    'transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'text-white font-bold bg-transparent border-2 border-white ' +
    'shadow-[3px_3px_0px_#555] hover:shadow-[5px_5px_0px_#fff] ' +
    'uppercase tracking-widest font-mono ' +
    'transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'text-[#a0a0a0] font-medium border border-transparent hover:text-white hover:border-white/30 ' +
    'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97, x: 2, y: 2 }}
        whileHover={variant !== 'ghost' ? { x: -1, y: -1 } : {}}
        transition={{ type: 'spring', stiffness: 600, damping: 20 }}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 cursor-pointer ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...(props as any)}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
export default Button
