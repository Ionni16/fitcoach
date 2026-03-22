'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function ClienteDetail() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams()
  const [client, setClient] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [tab, setTab] = useState('overview')
  const [programs, setPrograms] = useState<any[]>([])
  const [assignedPrograms, setAssignedPrograms] = useState<any[]>([])
  const [assigning, setAssigning] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState('')
  const [startWeek, setStartWeek] = useState(1)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: c } = await supabase.from('clients').select('*').eq('id', id).single()
    setClient(c)
    const { data: l } = await supabase.from('weight_logs')
      .select('*, exercises(name)')
      .eq('client_id', id)
      .order('logged_at', { ascending: false })
      .limit(50)
    setLogs(l || [])
    const { data: p } = await supabase.from('programs').select('*').order('created_at', { ascending: false })
    setPrograms(p || [])
    const { data: ap } = await supabase.from('client_programs')
      .select('*, programs(name, total_weeks, days_per_week, goal, level)')
      .eq('client_id', id)
      .order('started_at', { ascending: false })
    setAssignedPrograms(ap || [])
  }

  async function copyLink() {
    const { data } = await supabase
      .from('clients').select('access_token').eq('id', id as string).single()
    if (data?.access_token) {
      const link = `${window.location.origin}/cliente/${data.access_token}`
      await navigator.clipboard.writeText(link)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    }
  }

  async function assignProgram() {
    if (!selectedProgram) return
    await supabase.from('client_programs').insert({
      client_id: id,
      program_id: selectedProgram,
      current_week: startWeek,
      is_active: true,
      started_at: new Date().toISOString().slice(0, 10)
    })
    setAssigning(false)
    setSelectedProgram('')
    load()
  }

  async function updateWeek(cpId: string, week: number) {
    await supabase.from('client_programs').update({ current_week: week }).eq('id', cpId)
    setAssignedPrograms(prev => prev.map(ap => ap.id === cpId ? { ...ap, current_week: week } : ap))
  }

  async function toggleActive(cpId: string, current: boolean) {
    await supabase.from('client_programs').update({ is_active: !current }).eq('id', cpId)
    load()
  }

  async function removeProgram(cpId: string) {
    if (!confirm('Rimuovere questa scheda?')) return
    await supabase.from('client_programs').delete().eq('id', cpId)
    load()
  }

  if (!client) return <div style={{ padding: 28, color: 'var(--text3)' }}>Caricamento...</div>

  const initials = client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const activeProgram = assignedPrograms.find(ap => ap.is_active)

  return (
    <div>
      {/* HEADER */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 28px' }}>
        <button onClick={() => router.push('/dashboard/clienti')} style={{
          background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0
        }}>← Clienti</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(180,255,79,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: 'var(--accent)'
          }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-syne)', fontSize: 22, fontWeight: 700 }}>{client.name}</div>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>
              {client.level || 'Intermedio'} · {client.goal || '—'} · {client.email || '—'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {activeProgram && (
                <span style={{
                  background: 'rgba(180,255,79,0.12)', color: 'var(--accent)',
                  borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 500
                }}>📋 {activeProgram.programs?.name} · Sett. {activeProgram.current_week}/{activeProgram.programs?.total_weeks}</span>
              )}
            </div>
          </div>

          {/* BOTTONI HEADER */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* BOTTONE LINK CLIENTE */}
            <button onClick={copyLink} style={{
              background: linkCopied ? 'rgba(180,255,79,0.2)' : 'rgba(180,255,79,0.1)',
              border: '1px solid rgba(180,255,79,0.3)',
              borderRadius: 8, padding: '8px 14px', fontSize: 13,
              color: 'var(--accent)', cursor: 'pointer', fontWeight: 500,
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
            }}>
              {linkCopied ? '✓ Copiato!' : '🔗 Link cliente'}
            </button>

            {/* BOTTONE ASSEGNA */}
            <button onClick={() => setAssigning(true)} style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer'
            }}>+ Assegna scheda</button>

            {/* BOTTONE SESSIONE */}
            {activeProgram && (
              <button onClick={() => router.push(`/dashboard/clienti/${id}/sessione`)} style={{
                background: 'var(--accent)', color: '#0C0D10', border: 'none',
                borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>▶ Inizia sessione</button>
            )}
          </div>
        </div>
      </div>

      {/* MODAL ASSEGNA SCHEDA */}
      {assigning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border2)',
            borderRadius: 16, padding: 28, width: '100%', maxWidth: 480
          }}>
            <div style={{ fontFamily: 'var(--font-syne)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
              Assegna scheda a {client.name}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Programma</label>
              <select
                value={selectedProgram}
                onChange={e => setSelectedProgram(e.target.value)}
                style={{
                  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
                  borderRadius: 8, padding: '10px 12px', color: selectedProgram ? 'var(--text)' : 'var(--text3)',
                  fontSize: 14, outline: 'none', cursor: 'pointer'
                }}>
                <option value="">Seleziona un programma...</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.total_weeks} sett. · {p.days_per_week} giorni
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                Inizia dalla settimana
              </label>
              <input
                type="number" min="1" max="20" value={startWeek}
                onChange={e => setStartWeek(parseInt(e.target.value))}
                style={{
                  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
                  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none'
                }}
              />
            </div>

            {selectedProgram && (
              <div style={{
                background: 'rgba(180,255,79,0.06)', border: '1px solid rgba(180,255,79,0.2)',
                borderRadius: 8, padding: '10px 14px', fontSize: 12,
                color: 'var(--text2)', marginBottom: 20
              }}>
                {(() => {
                  const p = programs.find(p => p.id === selectedProgram)
                  return p ? `${p.name} · ${p.goal || '—'} · ${p.level || 'Intermedio'} · ${p.total_weeks} settimane` : ''
                })()}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setAssigning(false); setSelectedProgram('') }} style={{
                flex: 1, background: 'none', border: '1px solid var(--border2)',
                borderRadius: 8, padding: 11, fontSize: 14, color: 'var(--text2)', cursor: 'pointer'
              }}>Annulla</button>
              <button onClick={assignProgram} disabled={!selectedProgram} style={{
                flex: 2, background: selectedProgram ? 'var(--accent)' : 'var(--surface2)',
                color: selectedProgram ? '#0C0D10' : 'var(--text3)',
                border: 'none', borderRadius: 8, padding: 11,
                fontSize: 14, fontWeight: 600, cursor: selectedProgram ? 'pointer' : 'not-allowed'
              }}>Assegna scheda</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '0 28px' }}>
        {/* TABS */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {['overview', 'schede', 'storico', 'misurazioni'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 16px', fontSize: 13.5, border: 'none', background: 'none',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text3)',
              cursor: 'pointer', fontWeight: tab === t ? 500 : 400,
              marginBottom: -1, textTransform: 'capitalize'
            }}>{t}</button>
          ))}
        </div>

        {/* TAB OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Sessioni totali', value: new Set(logs.map(l => l.logged_at?.slice(0, 10))).size },
                { label: 'Pesi inseriti', value: logs.length },
                { label: 'Ultima sessione', value: logs[0] ? new Date(logs[0].logged_at).toLocaleDateString('it-IT') : '—' },
              ].map((s, i) => (
                <div key={i} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px'
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 28, fontWeight: 500 }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Ultimi pesi loggati</div>
              {logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>
                  Nessuna sessione ancora
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Esercizio', 'Sett.', 'Set', 'Kg', 'Reps', 'Data'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 15).map(log => (
                      <tr key={log.id}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>{log.exercises?.name || '—'}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>{log.week_num}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>{log.set_num}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'var(--font-dm-mono)', fontSize: 13, fontWeight: 500 }}>{log.kg} kg</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>{log.reps_done || '—'}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12 }}>{new Date(log.logged_at).toLocaleDateString('it-IT')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB SCHEDE */}
        {tab === 'schede' && (
          <div>
            {assignedPrograms.length === 0 ? (
              <div style={{
                background: 'var(--surface)', border: '1px dashed var(--border2)',
                borderRadius: 14, padding: '50px 20px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>Nessuna scheda assegnata</div>
                <button onClick={() => setAssigning(true)} style={{
                  background: 'var(--accent)', color: '#0C0D10', border: 'none',
                  borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}>+ Assegna prima scheda</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {assignedPrograms.map(ap => (
                  <div key={ap.id} style={{
                    background: 'var(--surface)', border: `1px solid ${ap.is_active ? 'rgba(180,255,79,0.3)' : 'var(--border)'}`,
                    borderRadius: 14, padding: '18px 20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {ap.is_active && (
                          <span style={{
                            background: 'rgba(180,255,79,0.12)', color: 'var(--accent)',
                            borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 500
                          }}>● Attiva</span>
                        )}
                        <span style={{ fontFamily: 'var(--font-syne)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                          {ap.programs?.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => toggleActive(ap.id, ap.is_active)} style={{
                          background: 'var(--surface2)', border: '1px solid var(--border2)',
                          borderRadius: 6, padding: '5px 10px', fontSize: 11,
                          color: ap.is_active ? 'var(--red)' : 'var(--accent)', cursor: 'pointer'
                        }}>{ap.is_active ? 'Disattiva' : 'Attiva'}</button>
                        <button onClick={() => removeProgram(ap.id)} style={{
                          background: 'none', border: '1px solid var(--border2)',
                          borderRadius: 6, padding: '5px 8px', fontSize: 11,
                          color: 'var(--text3)', cursor: 'pointer'
                        }}>✕</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                          {ap.programs?.goal || '—'} · {ap.programs?.level || '—'} · {ap.programs?.days_per_week} giorni/sett.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', background: 'var(--accent)', borderRadius: 2,
                              width: `${Math.min((ap.current_week / ap.programs?.total_weeks) * 100, 100)}%`,
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)', whiteSpace: 'nowrap' }}>
                            Sett. {ap.current_week}/{ap.programs?.total_weeks}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => updateWeek(ap.id, Math.max(1, ap.current_week - 1))} style={{
                          background: 'var(--surface2)', border: '1px solid var(--border2)',
                          borderRadius: 6, padding: '4px 10px', color: 'var(--text2)', cursor: 'pointer', fontSize: 14
                        }}>←</button>
                        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: 'var(--text)', minWidth: 24, textAlign: 'center' }}>{ap.current_week}</span>
                        <button onClick={() => updateWeek(ap.id, Math.min(ap.programs?.total_weeks, ap.current_week + 1))} style={{
                          background: 'var(--surface2)', border: '1px solid var(--border2)',
                          borderRadius: 6, padding: '4px 10px', color: 'var(--text2)', cursor: 'pointer', fontSize: 14
                        }}>→</button>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)' }}>
                      Iniziata il {new Date(ap.started_at).toLocaleDateString('it-IT')}
                    </div>
                  </div>
                ))}

                <button onClick={() => setAssigning(true)} style={{
                  background: 'none', border: '1px dashed var(--border2)',
                  borderRadius: 12, padding: '12px', fontSize: 13,
                  color: 'var(--text3)', cursor: 'pointer', width: '100%'
                }}>+ Assegna altra scheda</button>
              </div>
            )}
          </div>
        )}

        {/* TAB STORICO */}
        {tab === 'storico' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Storico per esercizio</div>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nessun dato ancora</div>
            ) : (
              Object.entries(
                logs.reduce((acc: any, log) => {
                  const key = log.exercises?.name || 'Sconosciuto'
                  if (!acc[key]) acc[key] = []
                  acc[key].push(log)
                  return acc
                }, {})
              ).map(([exName, exLogs]: [string, any]) => (
                <div key={exName} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>{exName}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {exLogs.slice(0, 10).map((log: any) => (
                      <div key={log.id} style={{
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '8px 12px', textAlign: 'center'
                      }}>
                        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 16, color: 'var(--accent)', fontWeight: 500 }}>{log.kg}kg</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>×{log.reps_done} · S{log.week_num}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB MISURAZIONI */}
        {tab === 'misurazioni' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Misurazioni corporee</div>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>In arrivo — peso, circonferenze e foto progress.</div>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}