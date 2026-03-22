'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o password errati')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  async function handleRegister() {
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setError('Controlla la tua email per confermare!')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '40px', width: '100%', maxWidth: 400
      }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-syne)', fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>
            Fit<span style={{ color: 'var(--accent)' }}>Coach</span>
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>
            Accedi al tuo account
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="luca@example.com"
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
                borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14,
                outline: 'none'
              }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
                borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14,
                outline: 'none'
              }}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', background: 'var(--accent)', color: '#0C0D10',
            border: 'none', borderRadius: 8, padding: '11px', fontSize: 14,
            fontWeight: 600, cursor: 'pointer', marginBottom: 10
          }}>
            {loading ? 'Caricamento...' : 'Accedi'}
          </button>

          <button type="button" onClick={handleRegister} disabled={loading} style={{
            width: '100%', background: 'none', color: 'var(--text3)',
            border: '1px solid var(--border2)', borderRadius: 8, padding: '11px',
            fontSize: 14, cursor: 'pointer'
          }}>
            Prima volta? Registrati
          </button>
        </form>
      </div>
    </div>
  )
}