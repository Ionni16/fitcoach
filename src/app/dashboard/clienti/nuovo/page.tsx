'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NuovoCliente() {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', goal: '', level: 'Intermedio' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('clients').insert({
      ...form,
      trainer_id: user?.id
    })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/dashboard/clienti')
  }

  const inputStyle = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14, outline: 'none'
  }
  const labelStyle = { fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 } as any

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{
            background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13
          }}>← Indietro</button>
          <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 17 }}>Nuovo cliente</span>
        </div>
      </div>

      <div style={{ padding: 28, maxWidth: 560 }}>
        <form onSubmit={save}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 24
          }}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nome completo *</label>
              <input required style={inputStyle} value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Marco Rossi" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" style={inputStyle} value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="marco@example.com" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Obiettivo</label>
              <select style={{ ...inputStyle, cursor: 'pointer' } as any} value={form.goal}
                onChange={e => setForm({ ...form, goal: e.target.value })}>
                <option value="">Seleziona...</option>
                <option>Forza</option>
                <option>Ipertrofia</option>
                <option>Dimagrimento</option>
                <option>Resistenza</option>
                <option>Tonificazione</option>
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Livello</label>
              <select style={{ ...inputStyle, cursor: 'pointer' } as any} value={form.level}
                onChange={e => setForm({ ...form, level: e.target.value })}>
                <option>Principiante</option>
                <option>Intermedio</option>
                <option>Avanzato</option>
              </select>
            </div>

            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => router.back()} style={{
                flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)',
                borderRadius: 8, padding: 11, fontSize: 14, color: 'var(--text2)', cursor: 'pointer'
              }}>Annulla</button>
              <button type="submit" disabled={loading} style={{
                flex: 1, background: 'var(--accent)', color: '#0C0D10',
                border: 'none', borderRadius: 8, padding: 11,
                fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}>{loading ? 'Salvataggio...' : 'Salva cliente'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}