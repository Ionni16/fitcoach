'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
      setClients(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div>
      {/* TOPBAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10
      }}>
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 17 }}>Dashboard</span>
        <button onClick={() => router.push('/dashboard/clienti/nuovo')} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          background: 'var(--accent)', color: '#0C0D10', border: 'none',
          borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>+ Nuovo cliente</button>
      </div>

      <div style={{ padding: 28 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6, textTransform: 'capitalize' }}>{today}</div>
        <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: 24, fontWeight: 700, marginBottom: 28 }}>
          Bentornato 👋
        </h1>

        {/* STAT CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Clienti attivi', value: clients.length, sub: 'totale' },
            { label: 'Sessioni oggi', value: 0, sub: 'pianificate' },
            { label: 'Schede attive', value: 0, sub: 'programmi' },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '18px 20px'
            }}>
              <div style={{ fontSize: 11.5, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 32, fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* TABELLA CLIENTI */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14 }}>I tuoi clienti</span>
            <button onClick={() => router.push('/dashboard/clienti')} style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8,
              padding: '5px 12px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer'
            }}>Vedi tutti →</button>
          </div>

          {loading ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>Caricamento...</div>
          ) : clients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>Nessun cliente ancora</div>
              <button onClick={() => router.push('/dashboard/clienti/nuovo')} style={{
                background: 'var(--accent)', color: '#0C0D10', border: 'none',
                borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>+ Aggiungi il primo cliente</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Cliente', 'Obiettivo', 'Livello', 'Stato'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '10px 14px', borderBottom: '1px solid var(--border)'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.id}
                    onClick={() => router.push(`/dashboard/clienti/${client.id}`)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', background: 'rgba(180,255,79,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 600, color: 'var(--accent)', flexShrink: 0
                        }}>
                          {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: 13.5 }}>{client.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: 13.5 }}>{client.goal || '—'}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: 13.5 }}>{client.level || '—'}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{
                        background: 'rgba(180,255,79,0.12)', color: 'var(--accent)',
                        borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500
                      }}>Attivo</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}