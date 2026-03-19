'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Clienti() {
  const supabase = createClient()
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('clients').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setClients(data || []))
  }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)'
      }}>
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 17 }}>Clienti</span>
        <button onClick={() => router.push('/dashboard/clienti/nuovo')} style={{
          background: 'var(--accent)', color: '#0C0D10', border: 'none',
          borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>+ Nuovo cliente</button>
      </div>

      <div style={{ padding: 28 }}>
        <input
          placeholder="Cerca cliente..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 400, background: 'var(--surface)',
            border: '1px solid var(--border2)', borderRadius: 8,
            padding: '9px 14px', color: 'var(--text)', fontSize: 14,
            outline: 'none', marginBottom: 20
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(client => (
            <div key={client.id}
              onClick={() => router.push(`/dashboard/clienti/${client.id}`)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '14px 18px', display: 'flex',
                alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all 0.15s'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: 'rgba(180,255,79,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600, color: 'var(--accent)', flexShrink: 0
              }}>
                {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14.5, color: 'var(--text)' }}>{client.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {client.level || 'Intermedio'} · {client.goal || 'Nessun obiettivo'}
                </div>
              </div>
              <span style={{
                background: 'rgba(180,255,79,0.12)', color: 'var(--accent)',
                borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500
              }}>Attivo</span>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 13 }}>
              {search ? 'Nessun cliente trovato' : 'Nessun cliente ancora — aggiungine uno!'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}