'use client'
import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })

    if (loginError) {
      setError('Email o password errati')
      setLoading(false)
      return
    }

    const userId = data.user.id

    // Controlla se è un trainer
    const { data: trainer } = await supabase
      .from('trainers')
      .select('id')
      .eq('id', userId)
      .single()

    if (trainer) {
      router.push('/dashboard')
      return
    }

    // Controlla se è un cliente
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (client) {
      router.push('/cliente')
      return
    }

    // Utente non riconosciuto
    await supabase.auth.signOut()
    setError('Account non configurato. Contatta il tuo trainer.')
    setLoading(false)
  }

  const S = {
    bg: '#0C0D10', surface: '#13151A', border: 'rgba(255,255,255,0.07)',
    border2: 'rgba(255,255,255,0.12)', accent: '#B4FF4F',
    text: '#F0F0EE', text2: '#8A8D96', text3: '#50535C', red: '#FF5252'
  }

  return (
    <div style={{
      minHeight: '100vh', background: S.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, background: S.accent, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <svg width="26" height="26" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="6" width="14" height="4" rx="2" fill="#0C0D10"/>
              <rect x="4" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
              <rect x="9.5" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
            </svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: 24, color: S.text, letterSpacing: '-0.5px' }}>
            Fit<span style={{ color: S.accent }}>Coach</span>
          </div>
          <div style={{ fontSize: 13, color: S.text3, marginTop: 6 }}>
            Accedi al tuo account
          </div>
        </div>

        <div style={{
          background: S.surface, border: `1px solid ${S.border}`,
          borderRadius: 18, padding: 28
        }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: S.text2, display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Email
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="la-tua@email.com"
                style={{
                  width: '100%', background: '#1A1D24',
                  border: `1px solid ${S.border2}`, borderRadius: 10,
                  padding: '12px 14px', color: S.text, fontSize: 14,
                  outline: 'none', transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = S.accent}
                onBlur={e => e.target.style.borderColor = S.border2}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: S.text2, display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Password
              </label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', background: '#1A1D24',
                  border: `1px solid ${S.border2}`, borderRadius: 10,
                  padding: '12px 14px', color: S.text, fontSize: 14,
                  outline: 'none', transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = S.accent}
                onBlur={e => e.target.style.borderColor = S.border2}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13,
                color: S.red, marginBottom: 20
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: S.accent, color: '#0C0D10',
              border: 'none', borderRadius: 10, padding: '13px',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.8 : 1, transition: 'opacity 0.15s'
            }}>
              {loading ? 'Accesso in corso...' : 'Accedi →'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: S.text3 }}>
          Le credenziali ti vengono fornite dal trainer
        </div>
      </div>
    </div>
  )
}