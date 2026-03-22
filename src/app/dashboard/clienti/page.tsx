'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Clienti() {
  const supabase = createClient()
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('tutti')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('clients')
      .select('*, client_programs(current_week, is_active, programs(name, total_weeks))')
      .order('created_at', { ascending: false })
    setClients(data || [])
  }

  async function copyCredentials(client: any) {
    const origin = window.location.origin
    const text = `Ciao ${client.name}! 💪\n\nEcco come accedere a FitCoach:\n\n🌐 ${origin}/login\n📧 Email: ${client.email}\n🔑 Password: ${client.temp_password || '(già cambiata dal cliente)'}\n\nBuon allenamento!`
    await navigator.clipboard.writeText(text)
    setCopiedId(client.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  async function copyLink(client: any) {
    const link = `${window.location.origin}/cliente/${client.access_token}`
    await navigator.clipboard.writeText(link)
    setCopiedId(client.id + '-link')
    setTimeout(() => setCopiedId(null), 2500)
  }

  async function deleteClient(clientId: string) {
    if (!confirm('Eliminare questo cliente? Tutti i dati saranno cancellati.')) return
    await supabase.from('clients').delete().eq('id', clientId)
    load()
  }

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    const activeProgram = c.client_programs?.find((cp: any) => cp.is_active)
    if (filter === 'con-scheda') return matchSearch && activeProgram
    if (filter === 'senza-scheda') return matchSearch && !activeProgram
    return matchSearch
  })

  const goalColors: Record<string, string> = {
    'Ipertrofia': '#B4FF4F', 'Forza': '#FFB84F',
    'Dimagrimento': '#5B9BFF', 'Resistenza': '#5B9BFF',
    'Tonificazione': '#B4FF4F', 'Atletismo': '#FFB84F'
  }

  const levelColors: Record<string, string> = {
    'Principiante': '#5B9BFF', 'Intermedio': '#FFB84F', 'Avanzato': '#FF5252'
  }

  const S = {
    bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface2)',
    surface3: 'var(--surface3)', border: 'var(--border)', border2: 'var(--border2)',
    accent: 'var(--accent)', text: 'var(--text)', text2: 'var(--text2)',
    text3: 'var(--text3)', red: 'var(--red)', amber: 'var(--amber)', blue: 'var(--blue)'
  }

  return (
    <div>
      {/* TOPBAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px', borderBottom: `1px solid ${S.border}`,
        background: S.surface, position: 'sticky', top: 0, zIndex: 10
      }}>
        <div>
          <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 17 }}>Clienti</span>
          <span style={{ marginLeft: 10, fontSize: 12, color: S.text3 }}>{clients.length} totali</span>
        </div>
        <button onClick={() => router.push('/dashboard/clienti/nuovo')} style={{
          background: S.accent, color: '#0C0D10', border: 'none',
          borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6
        }}>+ Nuovo cliente</button>
      </div>

      <div style={{ padding: 28 }}>
        {/* FILTRI */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: S.text3 }}
              width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 2a5 5 0 100 10A5 5 0 007 2zM1 7a6 6 0 1110.89 3.477l3.817 3.816a.75.75 0 01-1.06 1.061l-3.817-3.816A6 6 0 011 7z"/>
            </svg>
            <input
              placeholder="Cerca per nome o email..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', background: S.surface, border: `1px solid ${S.border2}`,
                borderRadius: 8, padding: '9px 12px 9px 34px', color: S.text,
                fontSize: 13.5, outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['tutti', 'Tutti'], ['con-scheda', 'Con scheda'], ['senza-scheda', 'Senza scheda']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: filter === val ? 'rgba(180,255,79,0.12)' : S.surface,
                color: filter === val ? S.accent : S.text2,
                outline: filter === val ? 'none' : `1px solid ${S.border}`
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* CARDS GRID */}
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: S.surface, border: `1px dashed ${S.border2}`, borderRadius: 14
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 14, color: S.text2, marginBottom: 6 }}>
              {search ? 'Nessun cliente trovato' : 'Nessun cliente ancora'}
            </div>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 20 }}>
              {search ? 'Prova con un altro termine' : 'Aggiungi il tuo primo cliente'}
            </div>
            {!search && (
              <button onClick={() => router.push('/dashboard/clienti/nuovo')} style={{
                background: S.accent, color: '#0C0D10', border: 'none',
                borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>+ Aggiungi cliente</button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 16
          }}>
            {filtered.map(client => {
              const initials = client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              const activeProgram = client.client_programs?.find((cp: any) => cp.is_active)
              const goalColor = goalColors[client.goal] || S.accent
              const levelColor = levelColors[client.level] || S.text3
              const isRevealed = revealedId === client.id
              const progressPct = activeProgram
                ? Math.min((activeProgram.current_week / activeProgram.programs?.total_weeks) * 100, 100)
                : 0

              return (
                <div key={client.id} style={{
                  background: S.surface, border: `1px solid ${S.border}`,
                  borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.15s'
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = S.border2}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = S.border}
                >
                  {/* HEADER CARD */}
                  <div style={{
                    padding: '18px 20px 14px',
                    borderBottom: `1px solid ${S.border}`,
                    cursor: 'pointer'
                  }} onClick={() => router.push(`/dashboard/clienti/${client.id}`)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(180,255,79,0.12)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 700, color: S.accent
                      }}>{initials}</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: 15, color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {client.name}
                          </div>
                          {activeProgram && (
                            <div style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: S.accent, flexShrink: 0
                            }} />
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {client.goal && (
                            <span style={{
                              background: `${goalColor}18`, color: goalColor,
                              borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 500
                            }}>{client.goal}</span>
                          )}
                          {client.level && (
                            <span style={{
                              background: `${levelColor}18`, color: levelColor,
                              borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 500
                            }}>{client.level}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* INFO SEZIONE */}
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}` }}>
                    {/* Email */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 70 }}>Email</span>
                      <span style={{ fontSize: 13, color: S.text2, fontFamily: 'var(--font-dm-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {client.email || '—'}
                      </span>
                    </div>

                    {/* Password */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 70 }}>Password</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <span style={{ fontSize: 13, color: isRevealed ? S.text2 : S.text3, fontFamily: 'var(--font-dm-mono)' }}>
                          {isRevealed ? (client.temp_password || '—') : '••••••••'}
                        </span>
                        <button onClick={() => setRevealedId(isRevealed ? null : client.id)} style={{
                          background: 'none', border: 'none', color: S.text3,
                          cursor: 'pointer', fontSize: 12, padding: '2px 6px',
                          borderRadius: 4, transition: 'color 0.15s'
                        }}>
                          {isRevealed ? '🙈' : '👁'}
                        </button>
                      </div>
                    </div>

                    {/* Accesso */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 70 }}>Accesso</span>
                      <span style={{ fontSize: 13, color: client.user_id ? S.accent : S.amber }}>
                        {client.user_id ? '✓ Account attivo' : '⚠ Nessun account'}
                      </span>
                    </div>
                  </div>

                  {/* SCHEDA ASSEGNATA */}
                  <div style={{ padding: '12px 20px', borderBottom: `1px solid ${S.border}` }}>
                    {activeProgram ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: S.text }}>
                            {activeProgram.programs?.name}
                          </span>
                          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: S.text3 }}>
                            Sett. {activeProgram.current_week}/{activeProgram.programs?.total_weeks}
                          </span>
                        </div>
                        <div style={{ height: 4, background: S.surface3, borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', background: S.accent, borderRadius: 2,
                            width: `${progressPct}%`, transition: 'width 0.4s ease'
                          }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: S.text3 }}>Nessuna scheda assegnata</span>
                        <button
                          onClick={() => router.push(`/dashboard/clienti/${client.id}?tab=schede`)}
                          style={{
                            background: 'rgba(180,255,79,0.08)', border: '1px solid rgba(180,255,79,0.2)',
                            borderRadius: 6, padding: '4px 10px', fontSize: 11,
                            color: S.accent, cursor: 'pointer', fontWeight: 500
                          }}>+ Assegna</button>
                      </div>
                    )}
                  </div>

                  {/* AZIONI */}
                  <div style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
                    {/* Link diretto */}
                    <button onClick={() => copyLink(client)} title="Copia link accesso diretto" style={{
                      flex: 1, background: copiedId === client.id + '-link' ? 'rgba(180,255,79,0.15)' : S.surface2,
                      border: `1px solid ${S.border}`,
                      borderRadius: 8, padding: '7px 6px', fontSize: 11, fontWeight: 500,
                      color: copiedId === client.id + '-link' ? S.accent : S.text3,
                      cursor: 'pointer', transition: 'all 0.15s', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: 4
                    }}>
                      {copiedId === client.id + '-link' ? '✓ Copiato' : '🔗 Link'}
                    </button>

                    {/* Credenziali WhatsApp */}
                    <button onClick={() => copyCredentials(client)} title="Copia messaggio con credenziali" style={{
                      flex: 1, background: copiedId === client.id ? 'rgba(180,255,79,0.15)' : S.surface2,
                      border: `1px solid ${S.border}`,
                      borderRadius: 8, padding: '7px 6px', fontSize: 11, fontWeight: 500,
                      color: copiedId === client.id ? S.accent : S.text3,
                      cursor: 'pointer', transition: 'all 0.15s', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: 4
                    }}>
                      {copiedId === client.id ? '✓ Copiato' : '📱 WhatsApp'}
                    </button>

                    {/* Vai al profilo */}
                    <button onClick={() => router.push(`/dashboard/clienti/${client.id}`)} style={{
                      flex: 2, background: 'rgba(180,255,79,0.08)',
                      border: '1px solid rgba(180,255,79,0.2)',
                      borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600,
                      color: S.accent, cursor: 'pointer', transition: 'all 0.15s'
                    }}>Profilo →</button>

                    {/* Elimina */}
                    <button onClick={() => deleteClient(client.id)} title="Elimina cliente" style={{
                      width: 34, background: S.surface2, border: `1px solid ${S.border}`,
                      borderRadius: 8, fontSize: 14, color: S.text3, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s', flexShrink: 0
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,82,82,0.4)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = S.text3; (e.currentTarget as HTMLButtonElement).style.borderColor = S.border }}
                    >✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}