'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type Step = 'form' | 'verify' | 'success'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = (): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create account'); return }

      if (data.needsVerification) {
        setStep('verify')
      } else {
        setStep('success')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/confirm-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, full_name: fullName }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Verification failed'); return }
      setStep('success')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const Logo = () => (
    <div className="flex flex-col items-center mb-8">
      <div className="mb-4">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="14" fill="url(#logo-grad-s)" />
          <path d="M14 20h20M14 28h14M24 14v20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="34" cy="28" r="4" fill="white" fillOpacity="0.9" />
          <defs>
            <linearGradient id="logo-grad-s" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3B82F6" />
              <stop offset="1" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {step === 'form' && (
        <>
          <h1 className="text-2xl font-bold text-text-primary">Create your account</h1>
          <p className="text-text-muted text-sm mt-1">Start automating tests with Healix</p>
        </>
      )}
      {step === 'verify' && (
        <>
          <h1 className="text-2xl font-bold text-text-primary">Verify your email</h1>
          <p className="text-text-muted text-sm mt-1 text-center">We sent a 6-digit code to <span className="text-blue-400">{email}</span></p>
        </>
      )}
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-md"
    >
      <div className="glass-modal p-8">
        <AnimatePresence mode="wait">
          {step === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-4 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Account verified!</h3>
                <p className="text-text-muted text-sm mt-1">Your account is ready. Sign in to continue.</p>
              </div>
              <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
                Go to sign in
              </Link>
            </motion.div>
          ) : step === 'verify' ? (
            <motion.div key="verify" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
              <Logo />
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}
              <form onSubmit={handleVerify} className="flex flex-col gap-4">
                <Input
                  label="Verification code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoComplete="one-time-code"
                  maxLength={6}
                />
                <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-1">
                  Verify Email
                </Button>
              </form>
              <p className="text-center text-sm text-text-muted mt-6">
                Didn&apos;t receive a code?{' '}
                <button
                  type="button"
                  onClick={() => { setStep('form'); setError(null) }}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Go back
                </button>
              </p>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Logo />
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}
              <form onSubmit={handleSignup} className="flex flex-col gap-4">
                <Input
                  label="Full name"
                  type="text"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <Input
                  label="Confirm password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-1">
                  Create Account
                </Button>
              </form>
              <p className="text-center text-sm text-text-muted mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
