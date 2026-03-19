'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Schede() {
  const supabase = createClient()
  const router = useRouter()
  const [programs, setPrograms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('programs')
      .select('*')
      .order('created_at', { ascending: false })
    setPrograms(data || [])
    setLoading(false)
  }

  async function deleteProgram(id: string) {
    if (!confirm('Eliminare questa scheda?')) return
    await supabase.from('programs').delete().eq('id', id)
    load()
  }

  const goalColors: Record<string, string> = {
    'Forza': 'var(--amber)',
    'Ipertrofia': 'var(--accent)',
    'Dimagrimento': 'var(--blue)',
    'Resistenza': 'var(--blue)',
    'Tonificazione': 'var(--accent)',
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10
      }}>
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 17 }}>Schede</span>
        <button onClick={() => router.push('/dashboard/schede/nuova')} style={{
          background: 'var(--accent)', color: '#0C0D10', border: 'none',
          borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>+ Nuova scheda</button>
      </div>

      <div style={{ padding: 28 }}>
        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Caricamento...</div>
        ) : programs.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px dashed var(--border2)',
            borderRadius: 14, padding: '60px 20px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 6 }}>Nessuna scheda ancora</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>Crea il tuo primo programma di allenamento</div>
            <button onClick={() => router.push('/dashboard/schede/nuova')} style={{
              background: 'var(--accent)', color: '#0C0D10', border: 'none',
              borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>+ Crea prima scheda</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {programs.map(p => (
              <div key={p.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '20px', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-syne)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {p.total_weeks} settimane · {p.days_per_week} giorni/settimana
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => router.push(`/dashboard/schede/${p.id}`)} style={{
                      background: 'var(--surface2)', border: '1px solid var(--border2)',
                      borderRadius: 6, padding: '5px 10px', fontSize: 11,
                      color: 'var(--text2)', cursor: 'pointer'
                    }}>Modifica</button>
                    <button onClick={() => deleteProgram(p.id)} style={{
                      background: 'none', border: '1px solid var(--border2)',
                      borderRadius: 6, padding: '5px 8px', fontSize: 11,
                      color: 'var(--red)', cursor: 'pointer'
                    }}>✕</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {p.goal && (
                    <span style={{
                      background: 'rgba(180,255,79,0.1)', color: 'var(--accent)',
                      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500
                    }}>{p.goal}</span>
                  )}
                  {p.level && (
                    <span style={{
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'var(--text3)'
                    }}>{p.level}</span>
                  )}
                </div>

                <button onClick={() => router.push(`/dashboard/schede/${p.id}`)} style={{
                  width: '100%', background: 'none', border: '1px solid var(--border2)',
                  borderRadius: 8, padding: '8px', fontSize: 13, color: 'var(--text2)',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = '#0C0D10'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)' }}
                >
                  Apri builder →
                </button>
              </div>
            ))}

            {/* Card aggiungi nuova */}
            <div onClick={() => router.push('/dashboard/schede/nuova')} style={{
              background: 'none', border: '1px dashed var(--border2)',
              borderRadius: 14, padding: '20px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', minHeight: 160, gap: 8,
              transition: 'all 0.15s'
            }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)'}
            >
              <div style={{ fontSize: 24, color: 'var(--text3)' }}>+</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Nuova scheda</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}