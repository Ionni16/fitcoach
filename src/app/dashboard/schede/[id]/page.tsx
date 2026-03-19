'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function SchedaBuilder() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams()
  const [program, setProgram] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [exercises, setExercises] = useState<any[]>([])
  const [progressions, setProgressions] = useState<Record<string, any[]>>({})
  const [activeWeek, setActiveWeek] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(true)
  const [newSessionName, setNewSessionName] = useState('')
  const [addingSession, setAddingSession] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: p } = await supabase.from('programs').select('*').eq('id', id).single()
    setProgram(p)
    const { data: s } = await supabase.from('sessions').select('*').eq('program_id', id).order('day_index')
    setSessions(s || [])
    if (s && s.length > 0) { setActiveSession(s[0]); await loadExercises(s[0].id, p?.total_weeks || 4) }
    setLoading(false)
  }

  async function loadExercises(sessionId: string, totalWeeks: number) {
    const { data: exs } = await supabase.from('exercises').select('*').eq('session_id', sessionId).order('sort_order')
    setExercises(exs || [])
    if (!exs || exs.length === 0) return
    const exIds = exs.map((e: any) => e.id)
    const { data: progs } = await supabase.from('week_progressions').select('*').in('exercise_id', exIds)
    const map: Record<string, any[]> = {}
    exIds.forEach((eid: string) => { map[eid] = [] })
    ;(progs || []).forEach((p: any) => { if (map[p.exercise_id]) map[p.exercise_id].push(p) })
    // Se mancano settimane per qualche esercizio, creale di default
    for (const ex of exs) {
      const weeks = map[ex.id] || []
      for (let w = 1; w <= totalWeeks; w++) {
        if (!weeks.find((p: any) => p.week_num === w)) {
          const { data: newProg } = await supabase.from('week_progressions').insert({
            exercise_id: ex.id, week_num: w,
            name: ex.name,
            sets: ex.sets, reps: ex.reps, rir: ex.rir,
            is_deload: w === totalWeeks
          }).select().single()
          if (newProg) map[ex.id].push(newProg)
        }
      }
      map[ex.id].sort((a: any, b: any) => a.week_num - b.week_num)
    }
    setProgressions(map)
  }

  async function selectSession(sess: any) {
    setActiveSession(sess)
    await loadExercises(sess.id, program?.total_weeks || 4)
  }

  async function addSession() {
    if (!newSessionName.trim()) return
    const { data } = await supabase.from('sessions').insert({
      program_id: id, name: newSessionName.trim(), day_index: sessions.length
    }).select().single()
    if (data) { setSessions([...sessions, data]); setActiveSession(data); setExercises([]); setProgressions({}); setNewSessionName(''); setAddingSession(false) }
  }

  async function deleteSession(sessId: string) {
    if (!confirm('Eliminare questo giorno?')) return
    await supabase.from('sessions').delete().eq('id', sessId)
    const remaining = sessions.filter(s => s.id !== sessId)
    setSessions(remaining)
    if (remaining.length > 0) { setActiveSession(remaining[0]); loadExercises(remaining[0].id, program?.total_weeks || 4) }
    else { setActiveSession(null); setExercises([]) }
  }

  async function addExercise() {
    if (!activeSession) return
    const { data: ex } = await supabase.from('exercises').insert({
      session_id: activeSession.id, name: 'Nuovo esercizio',
      sets: 3, reps: '8-10', rir: 2, rest_seconds: 120, sort_order: exercises.length
    }).select().single()
    if (!ex) return
    const totalWeeks = program?.total_weeks || 4
    const newProgs: any[] = []
    for (let w = 1; w <= totalWeeks; w++) {
      const { data: prog } = await supabase.from('week_progressions').insert({
        exercise_id: ex.id, week_num: w, sets: 3, reps: '8-10', rir: 2, is_deload: w === totalWeeks
      }).select().single()
      if (prog) newProgs.push(prog)
    }
    setExercises(prev => [...prev, ex])
    setProgressions(prev => ({ ...prev, [ex.id]: newProgs }))
  }

  async function updateProgression(progId: string, exId: string, field: string, value: any) {
    setProgressions(prev => ({
      ...prev,
      [exId]: prev[exId].map(p => p.id === progId ? { ...p, [field]: value } : p)
    }))
    setSaved(false)
    await supabase.from('week_progressions').update({ [field]: value }).eq('id', progId)
    setSaved(true)
  }

  async function updateExerciseName(exId: string, name: string) {
    setExercises(prev => prev.map(e => e.id === exId ? { ...e, name } : e))
    setSaved(false)
    await supabase.from('exercises').update({ name }).eq('id', exId)
    setSaved(true)
  }

  async function updateExerciseRest(exId: string, rest_seconds: number) {
    setExercises(prev => prev.map(e => e.id === exId ? { ...e, rest_seconds } : e))
    await supabase.from('exercises').update({ rest_seconds }).eq('id', exId)
  }

  async function deleteExercise(exId: string) {
    if (!confirm('Eliminare esercizio?')) return
    await supabase.from('exercises').delete().eq('id', exId)
    setExercises(prev => prev.filter(e => e.id !== exId))
    setProgressions(prev => { const n = { ...prev }; delete n[exId]; return n })
  }

  const totalWeeks = program?.total_weeks || 4
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1)

  const inputSm: any = {
    width: '100%', background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 6, padding: '5px 6px', color: 'var(--text)',
    fontFamily: 'var(--font-dm-mono)', fontSize: 13, textAlign: 'center', outline: 'none'
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Caricamento...</div>
  if (!program) return <div style={{ padding: 40, color: 'var(--red)' }}>Scheda non trovata</div>

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* TOPBAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.push('/dashboard/schede')} style={{
            background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, padding: 0
          }}>← Schede</button>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 16 }}>{program.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
              {totalWeeks} settimane · {program.days_per_week} giorni · {program.level || 'Intermedio'}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: saved ? 'var(--accent)' : 'var(--amber)' }}>
          {saved ? '✓ Salvato automaticamente' : '⟳ Salvataggio...'}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR GIORNI */}
        <div style={{
          width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', flexShrink: 0
        }}>
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Giorni</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {sessions.map((sess, i) => (
              <div key={sess.id}
                onClick={() => selectSession(sess)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  borderRadius: 8, marginBottom: 2, cursor: 'pointer',
                  background: activeSession?.id === sess.id ? 'rgba(180,255,79,0.12)' : 'none',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => { if (activeSession?.id !== sess.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (activeSession?.id !== sess.id) (e.currentTarget as HTMLDivElement).style.background = 'none' }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                  background: activeSession?.id === sess.id ? 'var(--accent)' : 'var(--surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600,
                  color: activeSession?.id === sess.id ? '#0C0D10' : 'var(--text3)'
                }}>{i + 1}</div>
                <span style={{
                  fontSize: 12.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: activeSession?.id === sess.id ? 'var(--accent)' : 'var(--text2)'
                }}>{sess.name}</span>
                <button onClick={e => { e.stopPropagation(); deleteSession(sess.id) }} style={{
                  background: 'none', border: 'none', color: 'transparent',
                  cursor: 'pointer', fontSize: 12, padding: '0 2px'
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'transparent'}
                >✕</button>
              </div>
            ))}

            {addingSession ? (
              <div style={{ padding: '6px 4px' }}>
                <input autoFocus placeholder="es. Day 1 — Gambe"
                  value={newSessionName} onChange={e => setNewSessionName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addSession(); if (e.key === 'Escape') setAddingSession(false) }}
                  style={{
                    width: '100%', background: 'var(--surface2)', border: '1px solid var(--accent)',
                    borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 12, outline: 'none'
                  }} />
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <button onClick={addSession} style={{ flex: 1, background: 'var(--accent)', color: '#0C0D10', border: 'none', borderRadius: 6, padding: '5px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>OK</button>
                  <button onClick={() => setAddingSession(false)} style={{ flex: 1, background: 'none', border: '1px solid var(--border2)', borderRadius: 6, padding: '5px', fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingSession(true)} style={{
                width: '100%', background: 'none', border: '1px dashed var(--border2)',
                borderRadius: 8, padding: '7px', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', marginTop: 4
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)' }}
              >+ Aggiungi giorno</button>
            )}
          </div>
        </div>

        {/* AREA PRINCIPALE */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {!activeSession ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Aggiungi un giorno dalla sidebar
            </div>
          ) : (
            <>
              {/* HEADER + TAB SETTIMANE */}
              <div style={{
                padding: '16px 24px 0', background: 'var(--surface)',
                borderBottom: '1px solid var(--border)', flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-syne)', fontSize: 17, fontWeight: 700 }}>{activeSession.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{exercises.length} esercizi · {totalWeeks} settimane di progressione</div>
                  </div>
                  <button onClick={addExercise} style={{
                    background: 'var(--accent)', color: '#0C0D10', border: 'none',
                    borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}>+ Esercizio</button>
                </div>

                {/* TAB SETTIMANE */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {weeks.map(w => {
                    const isDeload = w === totalWeeks
                    const isActive = w === activeWeek
                    return (
                      <button key={w} onClick={() => setActiveWeek(w)} style={{
                        padding: '7px 16px', border: 'none', cursor: 'pointer',
                        borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                        background: 'none', marginBottom: -1, fontSize: 13, fontWeight: isActive ? 500 : 400,
                        color: isActive ? 'var(--accent)' : isDeload ? 'var(--amber)' : 'var(--text3)',
                        transition: 'all 0.15s'
                      }}>
                        {isDeload ? `Sett. ${w} 🔄` : `Sett. ${w}`}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ETICHETTA SETTIMANA */}
              <div style={{ padding: '12px 24px 0' }}>
                {activeWeek === totalWeeks && (
                  <div style={{
                    background: 'rgba(255,184,79,0.1)', border: '1px solid rgba(255,184,79,0.3)',
                    borderRadius: 8, padding: '8px 14px', fontSize: 12,
                    color: 'var(--amber)', marginBottom: 12
                  }}>
                    🔄 Settimana di scarico — volume dimezzato, stessi carichi della settimana precedente
                  </div>
                )}
              </div>

              {/* TABELLA ESERCIZI */}
              <div style={{ padding: '8px 24px 24px', flex: 1 }}>

                {/* HEADER COLONNE */}
                {exercises.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr 65px 80px 65px 95px 36px',
                    gap: 8, padding: '6px 14px', marginBottom: 4
                  }}>
                    {['#', 'Esercizio', 'Serie', 'Reps', 'Buffer', 'Recupero', ''].map((h, i) => (
                      <span key={i} style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                    ))}
                  </div>
                )}

                {exercises.map((ex, idx) => {
                  const weekProgs = progressions[ex.id] || []
                  const weekProg = weekProgs.find(p => p.week_num === activeWeek)

                  return (
                    <div key={ex.id} style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 10, marginBottom: 6, overflow: 'hidden'
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 1fr 65px 80px 65px 95px 36px',
                        gap: 8, padding: '11px 14px', alignItems: 'center'
                      }}>
                        {/* Numero */}
                        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: 'var(--text3)' }}>{idx + 1}</span>

                        {/* Nome esercizio */}
                        <input value={weekProg?.name ?? ex.name}
                          onChange={e => weekProg && updateProgression(weekProg.id, ex.id, 'name', e.target.value)}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--text)',
                            fontSize: 14, fontWeight: 500, outline: 'none', width: '100%',
                            borderBottom: '1px solid transparent', transition: 'border-color 0.15s'
                          }}
                          onFocus={e => (e.target as HTMLInputElement).style.borderBottomColor = 'var(--accent)'}
                          onBlur={e => (e.target as HTMLInputElement).style.borderBottomColor = 'transparent'}
                        />

                        {/* Serie — per settimana */}
                        {weekProg ? (
                          <input type="number" min="1" max="10"
                            value={weekProg.sets ?? ''}
                            onChange={e => updateProgression(weekProg.id, ex.id, 'sets', parseInt(e.target.value))}
                            style={inputSm} />
                        ) : <span style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>—</span>}

                        {/* Reps — per settimana */}
                        {weekProg ? (
                          <input value={weekProg.reps ?? ''}
                            onChange={e => updateProgression(weekProg.id, ex.id, 'reps', e.target.value)}
                            style={inputSm} placeholder="8-10" />
                        ) : <span style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>—</span>}

                        {/* Buffer — per settimana */}
                        {weekProg ? (
                          <input type="number" min="0" max="5"
                            value={weekProg.rir ?? ''}
                            onChange={e => updateProgression(weekProg.id, ex.id, 'rir', parseInt(e.target.value))}
                            style={inputSm} />
                        ) : <span />}

                        {/* Recupero — globale per esercizio */}
                        <select value={ex.rest_seconds}
                          onChange={e => updateExerciseRest(ex.id, parseInt(e.target.value))}
                          style={{ ...inputSm, cursor: 'pointer', textAlign: 'left', padding: '5px 6px' }}>
                          <option value={60}>1′00″</option>
                          <option value={75}>1′15″</option>
                          <option value={90}>1′30″</option>
                          <option value={120}>2′00″</option>
                          <option value={150}>2′30″</option>
                          <option value={180}>3′00″</option>
                          <option value={240}>4′00″</option>
                        </select>

                        {/* Elimina */}
                        <button onClick={() => deleteExercise(ex.id)} style={{
                          background: 'none', border: 'none', color: 'var(--text3)',
                          cursor: 'pointer', fontSize: 14, padding: 0
                        }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'}
                        >✕</button>
                      </div>

                      {/* Note settimana */}
                      {weekProg && (
                        <div style={{ padding: '0 14px 10px' }}>
                          <input
                            value={weekProg.notes ?? ''}
                            onChange={e => updateProgression(weekProg.id, ex.id, 'notes', e.target.value)}
                            placeholder="Note per questa settimana (es. aumenta carico del 2%, stessa intensità...)"
                            style={{
                              width: '100%', background: 'transparent', border: 'none',
                              borderBottom: '1px solid var(--border)', color: 'var(--text3)',
                              fontSize: 12, outline: 'none', padding: '4px 0',
                              fontStyle: 'italic'
                            }}
                            onFocus={e => (e.target as HTMLInputElement).style.borderBottomColor = 'var(--accent)'}
                            onBlur={e => (e.target as HTMLInputElement).style.borderBottomColor = 'var(--border)'}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}

                {exercises.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px', border: '1px dashed var(--border2)', borderRadius: 12 }}>
                    <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>Nessun esercizio ancora</div>
                    <button onClick={addExercise} style={{
                      background: 'var(--accent)', color: '#0C0D10', border: 'none',
                      borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                    }}>+ Aggiungi primo esercizio</button>
                  </div>
                ) : (
                  <button onClick={addExercise} style={{
                    width: '100%', marginTop: 4, background: 'none',
                    border: '1px dashed var(--border2)', borderRadius: 10,
                    padding: '9px', fontSize: 13, color: 'var(--text3)', cursor: 'pointer'
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)' }}
                  >+ Aggiungi esercizio</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}