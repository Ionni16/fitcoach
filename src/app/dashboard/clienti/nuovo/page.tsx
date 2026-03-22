'use client'
import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NuovoCliente() {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', email: '', password: '', goal: '', level: 'Intermedio'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<any>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      setError('Nome, email e password sono obbligatori')
      return
    }
    if (form.password.length < 6) {
      setError('La password deve essere almeno 6 caratteri')
      return
    }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const res = await fetch('/api/create-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, trainerId: user?.id })
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Errore nella creazione')
      setLoading(false)
      return
    }

    setCreated({ ...form, clientId: data.client.id })
    setLoading(false)
  }

  const inputStyle: any = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none'
  }

  const S = {
    bg: 'var(--bg)', surface: 'var(--surface)', border: 'var(--border)',
    border2: 'var(--border2)', accent: 'var(--accent)',
    text: 'var(--text)', text2: 'var(--text2)', text3: 'var(--text3)', red: 'var(--red)'
  }

  if (created) {
    return (
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 28px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)'
        }}>
          <button onClick={() => router.push('/dashboard/clienti')} style={{
            background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, padding: 0
          }}>← Clienti</button>
          <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 17 }}>Cliente creato!</span>
        </div>

        <div style={{ padding: 28, maxWidth: 520 }}>
          <div style={{
            background: 'rgba(180,255,79,0.06)', border: '1px solid rgba(180,255,79,0.3)',
            borderRadius: 14, padding: 24, marginBottom: 20
          }}>
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500, marginBottom: 16 }}>
              ✓ Account creato con successo
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Nome</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{created.name}</div>
            </div>

            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Credenziali da mandare al cliente
              </div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: 'var(--text)', lineHeight: 2 }}>
                <div>🌐 <span style={{ color: 'var(--text3)' }}>URL:</span> {typeof window !== 'undefined' ? window.location.origin : ''}/login</div>
                <div>📧 <span style={{ color: 'var(--text3)' }}>Email:</span> {created.email}</div>
                <div>🔑 <span style={{ color: 'var(--text3)' }}>Password:</span> {created.password}</div>
              </div>
            </div>

            <button onClick={() => {
              const text = `Ciao ${created.name}! 🏋️\n\nEcco le tue credenziali per FitCoach:\n\n🌐 Link: ${window.location.origin}/login\n📧 Email: ${created.email}\n🔑 Password: ${created.password}\n\nAccedi e trovi la tua scheda di allenamento pronta!`
              navigator.clipboard.writeText(text)
            }} style={{
              width: '100%', background: 'var(--accent)', color: '#0C0D10',
              border: 'none', borderRadius: 8, padding: '11px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8
            }}>
              📋 Copia messaggio WhatsApp
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => {
              setCreated(null)
              setForm({ name: '', email: '', password: '', goal: '', level: 'Intermedio' })
            }} style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--border2)',
              borderRadius: 8, padding: 11, fontSize: 14, color: 'var(--text2)', cursor: 'pointer'
            }}>+ Nuovo cliente</button>
            <button onClick={() => router.push(`/dashboard/clienti/${created.clientId}`)} style={{
              flex: 2, background: 'var(--accent)', color: '#0C0D10',
              border: 'none', borderRadius: 8, padding: 11,
              fontSize: 14, fontWeight: 600, cursor: 'pointer'
            }}>Vai al profilo →</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 28px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)'
      }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, padding: 0
        }}>← Indietro</button>
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 17 }}>Nuovo cliente</span>
      </div>

      <div style={{ padding: 28, maxWidth: 520 }}>
        <form onSubmit={save}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>Nome completo *</label>
              <input required style={inputStyle} value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Mario Rossi" />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>Email *</label>
              <input type="email" required style={inputStyle} value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="mario@example.com" />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Password temporanea *
              </label>
              <div style={{ position: 'relative' }}>
                <input required style={inputStyle} value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="min. 6 caratteri" />
                <button type="button" onClick={() => {
                  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
                  const pwd = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
                  setForm({ ...form, password: pwd })
                }} style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'var(--surface3)', border: 'none', borderRadius: 6,
                  padding: '4px 8px', fontSize: 11, color: 'var(--text3)', cursor: 'pointer'
                }}>Genera</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                Il cliente potrà cambiarla dopo il primo accesso
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>Obiettivo</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.goal}
                  onChange={e => setForm({ ...form, goal: e.target.value })}>
                  <option value="">Seleziona...</option>
                  <option>Ipertrofia</option>
                  <option>Forza</option>
                  <option>Dimagrimento</option>
                  <option>Resistenza</option>
                  <option>Tonificazione</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>Livello</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.level}
                  onChange={e => setForm({ ...form, level: e.target.value })}>
                  <option>Principiante</option>
                  <option>Intermedio</option>
                  <option>Avanzato</option>
                </select>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)'
              }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => router.back()} style={{
                flex: 1, background: 'none', border: '1px solid var(--border2)',
                borderRadius: 8, padding: 11, fontSize: 14, color: 'var(--text2)', cursor: 'pointer'
              }}>Annulla</button>
              <button type="submit" disabled={loading} style={{
                flex: 2, background: 'var(--accent)', color: '#0C0D10',
                border: 'none', borderRadius: 8, padding: 11,
                fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.8 : 1
              }}>{loading ? 'Creazione account...' : 'Crea cliente'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}