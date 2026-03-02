'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Profile } from '@/lib/types/database'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) return
        const { data } = await res.json()
        if (data) {
          setProfile(data)
          setFullName(data.full_name ?? '')
          setCompany(data.company ?? '')
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          company: company.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' })
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred' })
    }
    setSaving(false)
  }

  const initials = (fullName || profile?.email || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-bg-darkest p-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-text-primary mb-1">Profile</h1>
          <p className="text-text-muted text-sm mb-8">Manage your personal information</p>
        </motion.div>

        <Card delay={0.1} className="p-8">
          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="shimmer h-10 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {/* Avatar */}
              <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div>
                  <p className="text-text-primary font-semibold">{fullName || 'No name set'}</p>
                  <p className="text-text-muted text-sm">{profile?.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25 capitalize">
                    {profile?.plan ?? 'starter'}
                  </span>
                </div>
              </div>

              {/* Feedback */}
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mb-5 px-4 py-3 rounded-xl text-sm border ${
                    message.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/25 text-red-400'
                  }`}
                >
                  {message.text}
                </motion.div>
              )}

              <form onSubmit={handleSave} className="flex flex-col gap-5">
                <Input
                  label="Full name"
                  type="text"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <Input
                  label="Email"
                  type="email"
                  value={profile?.email ?? ''}
                  disabled
                  className="opacity-60 cursor-not-allowed"
                />
                <Input
                  label="Company"
                  type="text"
                  placeholder="Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" loading={saving}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
