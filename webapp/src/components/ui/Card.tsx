'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode
  gradient?: boolean
  delay?: number
  hover?: boolean
  className?: string
}

export default function Card({
  children,
  gradient = false,
  delay = 0,
  hover = true,
  className = '',
  ...props
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={
        hover
          ? {
              boxShadow: '0 0 40px rgba(59,130,246,0.2), 0 4px 32px rgba(0,0,0,0.4)',
              borderColor: 'rgba(59,130,246,0.3)',
            }
          : {}
      }
      className={[
        'relative backdrop-blur-xl',
        'bg-white/[0.03] border border-white/10',
        'rounded-[20px]',
        'shadow-[0_4px_32px_rgba(0,0,0,0.4)]',
        'transition-colors duration-300',
        gradient ? 'card-gradient-border' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </motion.div>
  )
}
