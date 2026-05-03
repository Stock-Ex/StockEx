'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const loadSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        setError(sessionError.message)
        return
      }
      setSession(data.session)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSignUp = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!email || !password) {
      setError('Bitte E-Mail und Passwort eingeben.')
      setLoading(false)
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (signUpError) {
      console.error('Signup error:', signUpError.message)
      setError(signUpError.message)
      alert(signUpError.message)
    } else {
      setSuccess('Registrierung erfolgreich. Bitte E-Mail bestätigen.')
      alert('Check your email for confirmation!')
    }

    setLoading(false)
  }

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!email || !password) {
      setError('Bitte E-Mail und Passwort eingeben.')
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) {
      console.error('Login error:', signInError.message)
      setError(signInError.message)
      alert(signInError.message)
    } else {
      setSuccess('Login erfolgreich.')
    }

    setLoading(false)
  }

  const handleSignOut = async () => {
    setLoading(true)
    setError(null)
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setError(signOutError.message)
    } else {
      setSuccess('Erfolgreich ausgeloggt.')
    }
    setLoading(false)
  }

  return (
    <div className="mb-8 rounded-xl border border-red-500/60 bg-red-950/30 p-4">
      <div style={{ color: 'red', fontWeight: 700 }} className="mb-4">
        AUTH COMPONENT LOADED
      </div>

      <div className="rounded-xl border border-luxury-anthracite/50 bg-luxury-charcoal/80 p-4">
        {!session ? (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">
              {mode === 'login' ? 'Login' : 'Registrierung'}
            </h2>

            <input
              type="email"
              placeholder="E-Mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-luxury-anthracite/70 bg-luxury-dark px-3 py-2 text-white"
            />

            <input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-luxury-anthracite/70 bg-luxury-dark px-3 py-2 text-white"
            />

            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-400">{success}</p>}

            {mode === 'login' ? (
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white disabled:opacity-60"
              >
                {loading ? 'Lädt...' : 'Login'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white disabled:opacity-60"
              >
                {loading ? 'Lädt...' : 'Registrieren'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="ml-3 text-sm text-gold-300 underline"
            >
              {mode === 'login'
                ? 'Noch keinen Account? Registrieren'
                : 'Schon einen Account? Login'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-white">
              Eingeloggt als <span className="font-semibold">{session.user.email}</span>
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-400">{success}</p>}
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="rounded-lg bg-luxury-anthracite px-4 py-2 text-white disabled:opacity-60"
            >
              {loading ? 'Lädt...' : 'Logout'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
