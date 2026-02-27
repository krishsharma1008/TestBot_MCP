'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode
  gradient?: boolean
  delay?: number
  hover?: boolean
  className?: string
  white?: boolean
}

export default function Card({
  children,
  gradient = false,
  delay = 0,
  hover = true,
  white = false,
  className = '',
  ...props
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      whileHover={
        hover
          ? white
            ? { boxShadow: '6px 6px 0px #555555', x: -1, y: -1 }
            : { boxShadow: '6px 6px 0px #ffffff', x: -1, y: -1, borderColor: '#ffffff' }
          : {}
      }
      className={[
        'relative',
        white
          ? 'bg-white text-black border-2 border-black shadow-[4px_4px_0px_#555555]'
          : 'bg-[#111111] text-white border-2 border-[#333333] shadow-[4px_4px_0px_#555555]',
        'rounded-none',
        'transition-colors duration-100',
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
