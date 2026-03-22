'use client'
import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ClienteLogin() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: client } = await supabase
      .from('clients')
      .select('access_token, name')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (!client) {
      setError('Email non trovata. Contatta il tuo trainer.')
      setLoading(false)
      return
    }

    router.push(`/cliente/${client.access_token}`)
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
            width: 48, height: 48, background: S.accent, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="6" width="14" height="4" rx="2" fill="#0C0D10"/>
              <rect x="4" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
              <rect x="9.5" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
            </svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, color: S.text }}>
            Fit<span style={{ color: S.accent }}>Coach</span>
          </div>
          <div style={{ fontSize: 13, color: S.text3, marginTop: 4 }}>
            Accedi alla tua area personale
          </div>
        </div>

        <div style={{
          background: S.surface, border: `1px solid ${S.border}`,
          borderRadius: 16, padding: 28
        }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: S.text2, display: 'block', marginBottom: 6 }}>
                La tua email
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="mario@example.com"
                style={{
                  width: '100%', background: '#1A1D24',
                  border: `1px solid ${S.border2}`, borderRadius: 8,
                  padding: '11px 14px', color: S.text, fontSize: 14, outline: 'none'
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13,
                color: S.red, marginBottom: 16
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: S.accent, color: '#0C0D10',
              border: 'none', borderRadius: 10, padding: '13px',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.8 : 1
            }}>
              {loading ? 'Accesso in corso...' : 'Accedi →'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: S.text3 }}>
              Non hai un account? Contatta il tuo trainer.
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
