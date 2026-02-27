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
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
}

const variantClasses: Record<Variant, string> = {
  primary:
    'text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed ' +
    'bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 bg-[length:200%_200%] ' +
    'animate-gradient shadow-lg',
  secondary:
    'text-text-primary font-medium rounded-xl border border-white/10 ' +
    'bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 ' +
    'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'text-text-secondary font-medium rounded-xl hover:text-text-primary ' +
    'hover:bg-white/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        whileHover={variant === 'primary' ? { y: -1, boxShadow: '0 0 32px rgba(59,130,246,0.5)' } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
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
