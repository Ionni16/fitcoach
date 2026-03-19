'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NuovaScheda() {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    goal: '',
    level: 'Intermedio',
    total_weeks: 8,
    days_per_week: 3,
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { setError('Il nome è obbligatorio'); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: err } = await supabase
      .from('programs')
      .insert({ ...form, trainer_id: user?.id })
      .select()
      .single()
    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/dashboard/schede/${data.id}`)
  }

  const inputStyle: any = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none'
  }
  const labelStyle: any = {
    fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6, fontWeight: 500
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
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 17 }}>Nuova scheda</span>
      </div>

      <div style={{ padding: 28, maxWidth: 600 }}>
        <form onSubmit={save}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div>
              <label style={labelStyle}>Nome programma *</label>
              <input style={inputStyle} value={form.name} required
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="es. Push Pull Legs, BIGGHY, Forza Base..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Obiettivo</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.goal}
                  onChange={e => setForm({ ...form, goal: e.target.value })}>
                  <option value="">Seleziona...</option>
                  <option>Ipertrofia</option>
                  <option>Forza</option>
                  <option>Dimagrimento</option>
                  <option>Resistenza</option>
                  <option>Tonificazione</option>
                  <option>Atletismo</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Livello</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.level}
                  onChange={e => setForm({ ...form, level: e.target.value })}>
                  <option>Principiante</option>
                  <option>Intermedio</option>
                  <option>Avanzato</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Durata (settimane)</label>
                <input type="number" min="1" max="52" style={inputStyle}
                  value={form.total_weeks}
                  onChange={e => setForm({ ...form, total_weeks: parseInt(e.target.value) })} />
              </div>
              <div>
                <label style={labelStyle}>Giorni a settimana</label>
                <input type="number" min="1" max="7" style={inputStyle}
                  value={form.days_per_week}
                  onChange={e => setForm({ ...form, days_per_week: parseInt(e.target.value) })} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Note generali</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Obiettivi del mesociclo, note per il cliente, indicazioni generali..." />
            </div>

            {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => router.back()} style={{
                flex: 1, background: 'none', border: '1px solid var(--border2)',
                borderRadius: 8, padding: 11, fontSize: 14, color: 'var(--text2)', cursor: 'pointer'
              }}>Annulla</button>
              <button type="submit" disabled={loading} style={{
                flex: 2, background: 'var(--accent)', color: '#0C0D10',
                border: 'none', borderRadius: 8, padding: 11,
                fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}>{loading ? 'Creazione...' : 'Crea scheda e aggiungi esercizi →'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}