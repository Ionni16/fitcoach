'use client'
import { useEffect, useState, FormEvent } from 'react'
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
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [creatingProgram, setCreatingProgram] = useState(false)
  const [newProgram, setNewProgram] = useState({ name: '', goal: '', level: 'Intermedio', total_weeks: 8, days_per_week: 3, notes: '' })
  const [notes, setNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [measurements, setMeasurements] = useState<any[]>([])
  const [addingMeasurement, setAddingMeasurement] = useState(false)
  const [newMeasurement, setNewMeasurement] = useState({ weight: '', chest: '', waist: '', hips: '', arm: '', thigh: '', notes: '' })
  const [revealPassword, setRevealPassword] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: c } = await supabase.from('clients').select('*').eq('id', id).single()
    setClient(c)
    setEditForm(c || {})

    const { data: l } = await supabase.from('weight_logs')
      .select('*, exercises(name, sessions(name))')
      .eq('client_id', id)
      .order('logged_at', { ascending: false })
      .limit(100)
    setLogs(l || [])

    const { data: p } = await supabase.from('programs').select('*').order('created_at', { ascending: false })
    setPrograms(p || [])

    const { data: ap } = await supabase.from('client_programs')
      .select('*, programs(name, total_weeks, days_per_week, goal, level)')
      .eq('client_id', id)
      .order('started_at', { ascending: false })
    setAssignedPrograms(ap || [])

    const { data: n } = await supabase.from('trainer_notes')
      .select('*').eq('client_id', id).order('created_at', { ascending: false })
    setNotes(n || [])

    const { data: m } = await supabase.from('measurements')
      .select('*').eq('client_id', id).order('measured_at', { ascending: false })
    setMeasurements(m || [])
  }

  async function saveClient(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('clients').update({
      name: editForm.name,
      email: editForm.email,
      goal: editForm.goal,
      level: editForm.level,
      phone: editForm.phone,
      birthdate: editForm.birthdate,
      notes: editForm.notes,
    }).eq('id', id as string)
    setSaving(false)
    setEditing(false)
    load()
  }

  async function assignProgram() {
    if (!selectedProgram) return
    await supabase.from('client_programs').update({ is_active: false }).eq('client_id', id)
    await supabase.from('client_programs').insert({
      client_id: id, program_id: selectedProgram,
      current_week: startWeek, is_active: true,
      started_at: new Date().toISOString().slice(0, 10)
    })
    setAssigning(false)
    setSelectedProgram('')
    load()
  }

  async function createAndAssignProgram() {
    if (!newProgram.name) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prog } = await supabase.from('programs')
      .insert({ ...newProgram, trainer_id: user?.id })
      .select().single()
    if (prog) {
      await supabase.from('client_programs').update({ is_active: false }).eq('client_id', id)
      await supabase.from('client_programs').insert({
        client_id: id, program_id: prog.id,
        current_week: 1, is_active: true,
        started_at: new Date().toISOString().slice(0, 10)
      })
      router.push(`/dashboard/schede/${prog.id}`)
    }
    setSaving(false)
  }

  async function updateWeek(cpId: string, week: number) {
    await supabase.from('client_programs').update({ current_week: week }).eq('id', cpId)
    setAssignedPrograms(prev => prev.map(ap => ap.id === cpId ? { ...ap, current_week: week } : ap))
  }

  async function toggleActive(cpId: string, current: boolean) {
    if (!current) await supabase.from('client_programs').update({ is_active: false }).eq('client_id', id)
    await supabase.from('client_programs').update({ is_active: !current }).eq('id', cpId)
    load()
  }

  async function removeProgram(cpId: string) {
    if (!confirm('Rimuovere questa scheda?')) return
    await supabase.from('client_programs').delete().eq('id', cpId)
    load()
  }

  async function addNote() {
    if (!newNote.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('trainer_notes').insert({
      client_id: id, trainer_id: user?.id,
      content: newNote.trim(), created_at: new Date().toISOString()
    })
    setNewNote('')
    setAddingNote(false)
    load()
  }

  async function deleteNote(noteId: string) {
    await supabase.from('trainer_notes').delete().eq('id', noteId)
    load()
  }

  async function saveMeasurement() {
    await supabase.from('measurements').insert({
      client_id: id,
      weight: newMeasurement.weight ? parseFloat(newMeasurement.weight) : null,
      chest: newMeasurement.chest ? parseFloat(newMeasurement.chest) : null,
      waist: newMeasurement.waist ? parseFloat(newMeasurement.waist) : null,
      hips: newMeasurement.hips ? parseFloat(newMeasurement.hips) : null,
      arm: newMeasurement.arm ? parseFloat(newMeasurement.arm) : null,
      thigh: newMeasurement.thigh ? parseFloat(newMeasurement.thigh) : null,
      notes: newMeasurement.notes,
      measured_at: new Date().toISOString()
    })
    setAddingMeasurement(false)
    setNewMeasurement({ weight: '', chest: '', waist: '', hips: '', arm: '', thigh: '', notes: '' })
    load()
  }

  async function copyLink() {
    const link = `${window.location.origin}/cliente/${client.access_token}`
    await navigator.clipboard.writeText(link)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  async function copyCredentials() {
    const text = `Ciao ${client.name}! 💪\n\n🌐 ${window.location.origin}/login\n📧 Email: ${client.email}\n🔑 Password: ${client.temp_password || '(già cambiata)'}\n\nBuon allenamento!`
    await navigator.clipboard.writeText(text)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  if (!client) return <div style={{ padding: 28, color: 'var(--text3)', fontFamily: 'var(--font-syne)' }}>Caricamento...</div>

  const initials = client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const activeProgram = assignedPrograms.find(ap => ap.is_active)
  const totalSessions = new Set(logs.map(l => l.logged_at?.slice(0, 10))).size
  const totalVolume = logs.reduce((a, l) => a + (l.kg || 0), 0)
  const prMap: Record<string, number> = {}
  logs.forEach(l => {
    const name = l.exercises?.name
    if (name && (!prMap[name] || l.kg > prMap[name])) prMap[name] = l.kg
  })

  const inputStyle: any = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14, outline: 'none'
  }

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'schede', label: 'Schede' },
    { id: 'storico', label: 'Storico pesi' },
    { id: 'misurazioni', label: 'Misurazioni' },
    { id: 'note', label: 'Note' },
    { id: 'account', label: 'Account' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* HEADER HERO */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 28px' }}>
        <button onClick={() => router.push('/dashboard/clienti')} style={{
          background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13,
          cursor: 'pointer', marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 4
        }}>← Tutti i clienti</button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(180,255,79,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: 'var(--accent)',
            border: '2px solid rgba(180,255,79,0.3)'
          }}>{initials}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-syne)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                {client.name}
              </div>
              {activeProgram && (
                <span style={{
                  background: 'rgba(180,255,79,0.12)', color: 'var(--accent)',
                  borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 500
                }}>● {activeProgram.programs?.name} · Sett. {activeProgram.current_week}/{activeProgram.programs?.total_weeks}</span>
              )}
              {!activeProgram && (
                <span style={{
                  background: 'rgba(255,184,79,0.12)', color: 'var(--amber)',
                  borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 500
                }}>⚠ Nessuna scheda</span>
              )}
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {client.email && <span>📧 {client.email}</span>}
              {client.phone && <span>📱 {client.phone}</span>}
              {client.goal && <span>🎯 {client.goal}</span>}
              {client.level && <span>⭐ {client.level}</span>}
              {client.birthdate && <span>🎂 {new Date(client.birthdate).toLocaleDateString('it-IT')}</span>}
            </div>

            {/* Stats rapide */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Sessioni', value: totalSessions },
                { label: 'Pesi loggati', value: logs.length },
                { label: 'PR personali', value: Object.keys(prMap).length },
                { label: 'Volume tot.', value: `${Math.round(totalVolume / 1000)}t` },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 18, fontWeight: 500, color: i === 2 ? 'var(--accent)' : 'var(--text)' }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Azioni header */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={copyCredentials} style={{
              background: linkCopied ? 'rgba(180,255,79,0.15)' : 'var(--surface2)',
              border: '1px solid var(--border2)', borderRadius: 8,
              padding: '8px 12px', fontSize: 12, color: linkCopied ? 'var(--accent)' : 'var(--text2)',
              cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap'
            }}>📱 {linkCopied ? 'Copiato!' : 'Cred. WhatsApp'}</button>

            <button onClick={copyLink} style={{
              background: 'rgba(180,255,79,0.08)', border: '1px solid rgba(180,255,79,0.2)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12,
              color: 'var(--accent)', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap'
            }}>🔗 Link diretto</button>

            <button onClick={() => { setEditing(true); setTab('account') }} style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12,
              color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap'
            }}>✏️ Modifica</button>

            <button onClick={() => setTab('schede')} style={{
              background: 'var(--accent)', color: '#0C0D10', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap'
            }}>+ Scheda</button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', overflowX: 'auto', paddingLeft: 28
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '11px 18px', fontSize: 13.5, border: 'none', background: 'none',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.id ? 'var(--accent)' : 'var(--text3)',
            cursor: 'pointer', fontWeight: tab === t.id ? 500 : 400,
            whiteSpace: 'nowrap', transition: 'color 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* ===== OVERVIEW ===== */}
        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Sessioni totali', value: totalSessions, sub: 'allenamenti completati', color: 'var(--text)' },
                { label: 'Pesi loggati', value: logs.length, sub: 'set registrati', color: 'var(--text)' },
                { label: 'PR personali', value: Object.keys(prMap).length, sub: 'record attivi', color: 'var(--accent)' },
                { label: 'Volume totale', value: `${Math.round(totalVolume).toLocaleString()} kg`, sub: 'kg sollevati in totale', color: 'var(--accent)' },
              ].map((s, i) => (
                <div key={i} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 14, padding: '18px 20px'
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 26, fontWeight: 500, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Sessioni recenti */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Ultimi allenamenti
                  <button onClick={() => setTab('storico')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>Vedi tutti →</button>
                </div>
                {logs.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nessuna sessione ancora</div>
                ) : (
                  Object.entries(
                    logs.slice(0, 20).reduce((acc: any, l) => {
                      const date = l.logged_at?.slice(0, 10)
                      if (!acc[date]) acc[date] = []
                      acc[date].push(l)
                      return acc
                    }, {})
                  ).slice(0, 5).map(([date, dayLogs]: [string, any]) => (
                    <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: 'rgba(180,255,79,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 600, color: 'var(--accent)', flexShrink: 0
                      }}>
                        {new Date(date).getDate()}/{new Date(date).getMonth() + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                          {new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{dayLogs.length} set · {dayLogs.reduce((a: number, l: any) => a + (l.kg || 0), 0).toFixed(0)} kg volume</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* PR Personali */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
                  🏆 Record personali
                </div>
                {Object.keys(prMap).length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nessun record ancora</div>
                ) : (
                  Object.entries(prMap).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 8).map(([name, kg]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 10 }}>{name}</span>
                      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 14, color: 'var(--accent)', fontWeight: 500, flexShrink: 0 }}>{kg as number} kg</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== SCHEDE ===== */}
        {tab === 'schede' && (
          <div>
            {/* Schede assegnate */}
            {assignedPrograms.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Schede assegnate</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {assignedPrograms.map(ap => (
                    <div key={ap.id} style={{
                      background: 'var(--surface)', border: `1px solid ${ap.is_active ? 'rgba(180,255,79,0.3)' : 'var(--border)'}`,
                      borderRadius: 14, padding: '18px 20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {ap.is_active && (
                            <span style={{ background: 'rgba(180,255,79,0.12)', color: 'var(--accent)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 500 }}>● Attiva</span>
                          )}
                          <span style={{ fontFamily: 'var(--font-syne)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{ap.programs?.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => router.push(`/dashboard/schede/${ap.program_id}`)} style={{
                            background: 'var(--surface2)', border: '1px solid var(--border2)',
                            borderRadius: 6, padding: '5px 10px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer'
                          }}>✏️ Modifica scheda</button>
                          <button onClick={() => toggleActive(ap.id, ap.is_active)} style={{
                            background: 'var(--surface2)', border: '1px solid var(--border2)',
                            borderRadius: 6, padding: '5px 10px', fontSize: 11,
                            color: ap.is_active ? 'var(--red)' : 'var(--accent)', cursor: 'pointer'
                          }}>{ap.is_active ? 'Disattiva' : 'Attiva'}</button>
                          <button onClick={() => removeProgram(ap.id)} style={{
                            background: 'none', border: '1px solid var(--border2)',
                            borderRadius: 6, padding: '5px 8px', fontSize: 11, color: 'var(--text3)', cursor: 'pointer'
                          }}>✕</button>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                        {ap.programs?.goal || '—'} · {ap.programs?.level || '—'} · {ap.programs?.days_per_week} giorni/sett. · {ap.programs?.total_weeks} settimane
                      </div>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                            <span>Progresso</span>
                            <span>Sett. {ap.current_week}/{ap.programs?.total_weeks}</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', background: 'var(--accent)', borderRadius: 3,
                              width: `${Math.min((ap.current_week / ap.programs?.total_weeks) * 100, 100)}%`
                            }} />
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
                      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
                        Iniziata il {new Date(ap.started_at).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Azioni scheda */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* Crea nuova scheda */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: 20
              }}>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  ✨ Crea scheda personalizzata
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                  Crea un programma nuovo su misura per {client.name.split(' ')[0]}
                </div>

                {!creatingProgram ? (
                  <button onClick={() => setCreatingProgram(true)} style={{
                    width: '100%', background: 'var(--accent)', color: '#0C0D10',
                    border: 'none', borderRadius: 8, padding: '10px',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}>+ Crea nuova scheda</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <input placeholder="Nome programma *" value={newProgram.name}
                      onChange={e => setNewProgram({ ...newProgram, name: e.target.value })}
                      style={{ ...inputStyle, fontSize: 13 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <select value={newProgram.goal}
                        onChange={e => setNewProgram({ ...newProgram, goal: e.target.value })}
                        style={{ ...inputStyle, fontSize: 13, cursor: 'pointer' }}>
                        <option value="">Obiettivo...</option>
                        <option>Ipertrofia</option><option>Forza</option>
                        <option>Dimagrimento</option><option>Tonificazione</option><option>Resistenza</option>
                      </select>
                      <select value={newProgram.level}
                        onChange={e => setNewProgram({ ...newProgram, level: e.target.value })}
                        style={{ ...inputStyle, fontSize: 13, cursor: 'pointer' }}>
                        <option>Principiante</option><option>Intermedio</option><option>Avanzato</option>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Settimane</div>
                        <input type="number" min="1" max="52" value={newProgram.total_weeks}
                          onChange={e => setNewProgram({ ...newProgram, total_weeks: parseInt(e.target.value) })}
                          style={{ ...inputStyle, fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Giorni/sett.</div>
                        <input type="number" min="1" max="7" value={newProgram.days_per_week}
                          onChange={e => setNewProgram({ ...newProgram, days_per_week: parseInt(e.target.value) })}
                          style={{ ...inputStyle, fontSize: 13 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setCreatingProgram(false)} style={{
                        flex: 1, background: 'none', border: '1px solid var(--border2)',
                        borderRadius: 8, padding: '8px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer'
                      }}>Annulla</button>
                      <button onClick={createAndAssignProgram} disabled={!newProgram.name || saving} style={{
                        flex: 2, background: 'var(--accent)', color: '#0C0D10', border: 'none',
                        borderRadius: 8, padding: '8px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                      }}>{saving ? 'Creazione...' : 'Crea e apri builder →'}</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Assegna esistente */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: 20
              }}>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  📋 Assegna scheda esistente
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                  Assegna un programma già creato
                </div>

                {!assigning ? (
                  <button onClick={() => setAssigning(true)} style={{
                    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
                    borderRadius: 8, padding: '10px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer'
                  }}>Scegli programma</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <select value={selectedProgram} onChange={e => setSelectedProgram(e.target.value)}
                      style={{ ...inputStyle, fontSize: 13, cursor: 'pointer' }}>
                      <option value="">Seleziona...</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — {p.total_weeks} sett.</option>
                      ))}
                    </select>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dalla settimana</div>
                      <input type="number" min="1" max="52" value={startWeek}
                        onChange={e => setStartWeek(parseInt(e.target.value))}
                        style={{ ...inputStyle, fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setAssigning(false)} style={{
                        flex: 1, background: 'none', border: '1px solid var(--border2)',
                        borderRadius: 8, padding: '8px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer'
                      }}>Annulla</button>
                      <button onClick={assignProgram} disabled={!selectedProgram} style={{
                        flex: 2, background: selectedProgram ? 'var(--accent)' : 'var(--surface2)',
                        color: selectedProgram ? '#0C0D10' : 'var(--text3)',
                        border: 'none', borderRadius: 8, padding: '8px',
                        fontSize: 13, fontWeight: 600, cursor: selectedProgram ? 'pointer' : 'not-allowed'
                      }}>Assegna</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== STORICO PESI ===== */}
        {tab === 'storico' && (
          <div>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 13 }}>
                Nessun dato ancora
              </div>
            ) : (
              <>
                {/* Per esercizio */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Storico per esercizio</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.entries(
                      logs.reduce((acc: any, l) => {
                        const name = l.exercises?.name || 'Sconosciuto'
                        if (!acc[name]) acc[name] = []
                        acc[name].push(l)
                        return acc
                      }, {})
                    ).map(([exName, exLogs]: [string, any]) => (
                      <div key={exName} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{exName}</span>
                          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                            PR: {Math.max(...exLogs.map((l: any) => l.kg || 0))} kg
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                          {exLogs.slice(0, 10).reverse().map((log: any) => {
                            const maxKg = Math.max(...exLogs.map((l: any) => l.kg || 0))
                            const isPR = log.kg === maxKg
                            return (
                              <div key={log.id} style={{
                                flexShrink: 0, background: isPR ? 'rgba(180,255,79,0.1)' : 'var(--surface2)',
                                border: `1px solid ${isPR ? 'rgba(180,255,79,0.3)' : 'var(--border)'}`,
                                borderRadius: 8, padding: '8px 12px', textAlign: 'center', minWidth: 70
                              }}>
                                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 15, color: isPR ? 'var(--accent)' : 'var(--text)', fontWeight: 500 }}>{log.kg}kg</div>
                                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>×{log.reps_done || '?'}</div>
                                <div style={{ fontSize: 10, color: 'var(--text3)' }}>S{log.week_num}</div>
                                {isPR && <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>PR</div>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabella completa */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Log completo</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['Esercizio', 'Sett.', 'Set', 'Kg', 'Reps', 'Data'].map(h => (
                          <th key={h} style={{ textAlign: 'left', fontSize: 10.5, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {logs.slice(0, 50).map(log => (
                          <tr key={log.id}
                            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)'}
                            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                          >
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>{log.exercises?.name || '—'}</td>
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>{log.week_num}</td>
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>{log.set_num}</td>
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'var(--font-dm-mono)', fontSize: 13, fontWeight: 500 }}>{log.kg} kg</td>
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>{log.reps_done || '—'}</td>
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12 }}>{new Date(log.logged_at).toLocaleDateString('it-IT')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== MISURAZIONI ===== */}
        {tab === 'misurazioni' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Storico misurazioni ({measurements.length})
              </div>
              <button onClick={() => setAddingMeasurement(true)} style={{
                background: 'var(--accent)', color: '#0C0D10', border: 'none',
                borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>+ Nuova misurazione</button>
            </div>

            {/* Form nuova misurazione */}
            {addingMeasurement && (
              <div style={{ background: 'var(--surface)', border: '1px solid rgba(180,255,79,0.3)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Nuova misurazione</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                  {[
                    { key: 'weight', label: 'Peso (kg)' },
                    { key: 'chest', label: 'Petto (cm)' },
                    { key: 'waist', label: 'Vita (cm)' },
                    { key: 'hips', label: 'Fianchi (cm)' },
                    { key: 'arm', label: 'Braccio (cm)' },
                    { key: 'thigh', label: 'Coscia (cm)' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{f.label}</div>
                      <input type="number" step="0.1" placeholder="—"
                        value={(newMeasurement as any)[f.key]}
                        onChange={e => setNewMeasurement({ ...newMeasurement, [f.key]: e.target.value })}
                        style={{ ...inputStyle, fontSize: 13 }} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Note</div>
                  <input placeholder="Note aggiuntive..." value={newMeasurement.notes}
                    onChange={e => setNewMeasurement({ ...newMeasurement, notes: e.target.value })}
                    style={{ ...inputStyle, fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setAddingMeasurement(false)} style={{
                    flex: 1, background: 'none', border: '1px solid var(--border2)',
                    borderRadius: 8, padding: '9px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer'
                  }}>Annulla</button>
                  <button onClick={saveMeasurement} style={{
                    flex: 2, background: 'var(--accent)', color: '#0C0D10', border: 'none',
                    borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}>Salva misurazione</button>
                </div>
              </div>
            )}

            {measurements.length === 0 && !addingMeasurement ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 13 }}>
                Nessuna misurazione ancora — aggiungine una!
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Data', 'Peso', 'Petto', 'Vita', 'Fianchi', 'Braccio', 'Coscia', 'Note'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 10.5, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {measurements.map(m => (
                      <tr key={m.id}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: 12 }}>{new Date(m.measured_at).toLocaleDateString('it-IT')}</td>
                        {['weight', 'chest', 'waist', 'hips', 'arm', 'thigh'].map(k => (
                          <td key={k} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: m[k] ? 'var(--text)' : 'var(--text3)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>
                            {m[k] ? `${m[k]} ${k === 'weight' ? 'kg' : 'cm'}` : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12 }}>{m.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===== NOTE TRAINER ===== */}
        {tab === 'note' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Note del trainer</div>
              <button onClick={() => setAddingNote(true)} style={{
                background: 'var(--accent)', color: '#0C0D10', border: 'none',
                borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>+ Aggiungi nota</button>
            </div>

            {addingNote && (
              <div style={{ background: 'var(--surface)', border: '1px solid rgba(180,255,79,0.3)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                <textarea
                  autoFocus placeholder="Scrivi una nota su questo cliente (tecnica, progressi, obiettivi, ecc.)..."
                  value={newNote} onChange={e => setNewNote(e.target.value)}
                  style={{ ...inputStyle, minHeight: 100, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => { setAddingNote(false); setNewNote('') }} style={{
                    flex: 1, background: 'none', border: '1px solid var(--border2)',
                    borderRadius: 8, padding: '9px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer'
                  }}>Annulla</button>
                  <button onClick={addNote} disabled={!newNote.trim()} style={{
                    flex: 2, background: newNote.trim() ? 'var(--accent)' : 'var(--surface2)',
                    color: newNote.trim() ? '#0C0D10' : 'var(--text3)',
                    border: 'none', borderRadius: 8, padding: '9px',
                    fontSize: 13, fontWeight: 600, cursor: newNote.trim() ? 'pointer' : 'not-allowed'
                  }}>Salva nota</button>
                </div>
              </div>
            )}

            {notes.length === 0 && !addingNote ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 13 }}>
                Nessuna nota ancora
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notes.map(note => (
                  <div key={note.id} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '16px 18px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {new Date(note.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      <button onClick={() => deleteNote(note.id)} style={{
                        background: 'none', border: 'none', color: 'var(--text3)',
                        cursor: 'pointer', fontSize: 14, padding: '0 4px'
                      }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'}
                      >✕</button>
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.7 }}>{note.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== ACCOUNT ===== */}
        {tab === 'account' && (
          <div style={{ maxWidth: 600 }}>
            {!editing ? (
              <div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 15 }}>Informazioni cliente</div>
                    <button onClick={() => setEditing(true)} style={{
                      background: 'var(--surface2)', border: '1px solid var(--border2)',
                      borderRadius: 8, padding: '6px 14px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer'
                    }}>✏️ Modifica</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {[
                      { label: 'Nome', value: client.name },
                      { label: 'Email', value: client.email || '—' },
                      { label: 'Telefono', value: client.phone || '—' },
                      { label: 'Data di nascita', value: client.birthdate ? new Date(client.birthdate).toLocaleDateString('it-IT') : '—' },
                      { label: 'Obiettivo', value: client.goal || '—' },
                      { label: 'Livello', value: client.level || '—' },
                    ].map((f, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{f.label}</div>
                        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: f.value === '—' ? 400 : 500 }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {client.notes && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Note generali</div>
                      <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>{client.notes}</div>
                    </div>
                  )}
                </div>

                {/* Credenziali accesso */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                  <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Credenziali accesso</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 80 }}>Stato</span>
                      <span style={{ fontSize: 13, color: client.user_id ? 'var(--accent)' : 'var(--amber)', fontWeight: 500 }}>
                        {client.user_id ? '✓ Account attivo' : '⚠ Nessun account Supabase'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 80 }}>Email</span>
                      <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)' }}>{client.email || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 80 }}>Password</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)' }}>
                          {revealPassword ? (client.temp_password || '(già modificata dal cliente)') : '••••••••'}
                        </span>
                        <button onClick={() => setRevealPassword(!revealPassword)} style={{
                          background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13
                        }}>{revealPassword ? '🙈' : '👁'}</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 80 }}>Link</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-dm-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        /cliente/{client.access_token?.slice(0, 20)}...
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    <button onClick={copyCredentials} style={{
                      flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)',
                      borderRadius: 8, padding: '10px', fontSize: 13, color: 'var(--text2)',
                      cursor: 'pointer', fontWeight: 500
                    }}>📱 Copia messaggio WhatsApp</button>
                    <button onClick={copyLink} style={{
                      flex: 1, background: 'rgba(180,255,79,0.08)', border: '1px solid rgba(180,255,79,0.2)',
                      borderRadius: 8, padding: '10px', fontSize: 13, color: 'var(--accent)',
                      cursor: 'pointer', fontWeight: 500
                    }}>🔗 Copia link diretto</button>
                  </div>
                </div>
              </div>
            ) : (
              /* FORM MODIFICA */
              <form onSubmit={saveClient}>
                <div style={{ background: 'var(--surface)', border: '1px solid rgba(180,255,79,0.2)', borderRadius: 14, padding: 24 }}>
                  <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 15, marginBottom: 20 }}>Modifica informazioni</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Nome *</label>
                      <input required style={inputStyle} value={editForm.name || ''}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Email</label>
                      <input type="email" style={inputStyle} value={editForm.email || ''}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Telefono</label>
                      <input style={inputStyle} value={editForm.phone || ''}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="+39 xxx xxx xxxx" />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Data di nascita</label>
                      <input type="date" style={inputStyle} value={editForm.birthdate || ''}
                        onChange={e => setEditForm({ ...editForm, birthdate: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Obiettivo</label>
                      <select style={{ ...inputStyle, cursor: 'pointer' }} value={editForm.goal || ''}
                        onChange={e => setEditForm({ ...editForm, goal: e.target.value })}>
                        <option value="">Seleziona...</option>
                        <option>Ipertrofia</option><option>Forza</option>
                        <option>Dimagrimento</option><option>Tonificazione</option><option>Resistenza</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Livello</label>
                      <select style={{ ...inputStyle, cursor: 'pointer' }} value={editForm.level || ''}
                        onChange={e => setEditForm({ ...editForm, level: e.target.value })}>
                        <option>Principiante</option><option>Intermedio</option><option>Avanzato</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Note generali</label>
                    <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                      value={editForm.notes || ''}
                      onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Informazioni aggiuntive, patologie, preferenze..." />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => setEditing(false)} style={{
                      flex: 1, background: 'none', border: '1px solid var(--border2)',
                      borderRadius: 8, padding: '11px', fontSize: 14, color: 'var(--text2)', cursor: 'pointer'
                    }}>Annulla</button>
                    <button type="submit" disabled={saving} style={{
                      flex: 2, background: 'var(--accent)', color: '#0C0D10',
                      border: 'none', borderRadius: 8, padding: '11px',
                      fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.8 : 1
                    }}>{saving ? 'Salvataggio...' : 'Salva modifiche'}</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  )
}