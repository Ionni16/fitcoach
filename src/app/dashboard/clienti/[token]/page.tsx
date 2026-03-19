'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'

export default function ClienteApp() {
  const supabase = createClient()
  const { token } = useParams()
  const [tab, setTab] = useState<'home' | 'sessione' | 'programma'>('home')
  const [client, setClient] = useState<any>(null)
  const [activeProgram, setActiveProgram] = useState<any>(null)
  const [program, setProgram] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [allExercises, setAllExercises] = useState<Record<string, any[]>>({})
  const [allProgressions, setAllProgressions] = useState<Record<string, any[]>>({})
  const [activeSession, setActiveSession] = useState<any>(null)
  const [sessionExercises, setSessionExercises] = useState<any[]>([])
  const [sessionProgressions, setSessionProgressions] = useState<Record<string, any>>({})
  const [prevLogs, setPrevLogs] = useState<any[]>([])
  const [logs, setLogs] = useState<Record<string, { kg: string; reps: string }>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [timer, setTimer] = useState<number | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [programWeek, setProgramWeek] = useState(1)
  const [error, setError] = useState('')
  const timerRef = useRef<any>(null)

  useEffect(() => { load() }, [token])

  async function load() {
    const { data: c } = await supabase
      .from('clients').select('*').eq('access_token', token).single()
    if (!c) { setError('Link non valido. Contatta il tuo trainer.'); setLoading(false); return }
    setClient(c)

    const { data: cp } = await supabase
      .from('client_programs')
      .select('*, programs(*)')
      .eq('client_id', c.id)
      .eq('is_active', true)
      .single()
    if (!cp) { setError('Nessuna scheda assegnata. Contatta il tuo trainer.'); setLoading(false); return }
    setActiveProgram(cp)
    setProgram(cp.programs)

    const { data: sess } = await supabase
      .from('sessions').select('*').eq('program_id', cp.program_id).order('day_index')
    setSessions(sess || [])

    // Carica tutti gli esercizi e progressioni per il programma completo
    const exMap: Record<string, any[]> = {}
    const progMap: Record<string, any[]> = {}
    for (const s of sess || []) {
      const { data: exs } = await supabase
        .from('exercises').select('*').eq('session_id', s.id).order('sort_order')
      exMap[s.id] = exs || []
      if (exs && exs.length > 0) {
        const { data: progs } = await supabase
          .from('week_progressions').select('*')
          .in('exercise_id', exs.map((e: any) => e.id))
          .order('week_num')
        progMap[s.id] = progs || []
      }
    }
    setAllExercises(exMap)
    setAllProgressions(progMap)

    // Imposta prima sessione come attiva per il log
    if (sess && sess.length > 0) {
      await loadSession(sess[0], cp, c.id, exMap)
    }
    setLoading(false)
  }

  async function loadSession(sess: any, cp: any, clientId: string, exMap: Record<string, any[]>) {
    setActiveSession(sess)
    setLogs({})
    setSaved(false)
    const exs = exMap[sess.id] || []
    setSessionExercises(exs)
    if (exs.length === 0) return

    const { data: progs } = await supabase
      .from('week_progressions').select('*')
      .in('exercise_id', exs.map((e: any) => e.id))
      .eq('week_num', cp.current_week)
    const pm: Record<string, any> = {}
    ;(progs || []).forEach((p: any) => { pm[p.exercise_id] = p })
    setSessionProgressions(pm)

    const { data: prev } = await supabase
      .from('weight_logs').select('*, exercises(name)')
      .eq('client_id', clientId)
      .eq('week_num', cp.current_week - 1)
    setPrevLogs(prev || [])
  }

  function setLog(exId: string, setNum: number, field: 'kg' | 'reps', value: string) {
    setLogs(p => ({ ...p, [`${exId}-${setNum}`]: { ...p[`${exId}-${setNum}`], [field]: value } }))
  }
  function getLog(exId: string, setNum: number) {
    return logs[`${exId}-${setNum}`] || { kg: '', reps: '' }
  }
  function getPrev(exName: string, setNum: number) {
    return prevLogs.find(l => l.exercises?.name === exName && l.set_num === setNum)?.kg || null
  }

  function startTimer(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimer(seconds); setTimerRunning(true)
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (!t || t <= 1) { clearInterval(timerRef.current); setTimerRunning(false); return 0 }
        return t - 1
      })
    }, 1000)
  }
  function fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

  async function saveSession() {
    if (!client || !activeProgram) return
    setSaving(true)
    const toInsert: any[] = []
    for (const ex of sessionExercises) {
      const prog = sessionProgressions[ex.id]
      const sets = prog?.sets || ex.sets
      for (let s = 1; s <= sets; s++) {
        const log = getLog(ex.id, s)
        if (log.kg) toInsert.push({
          client_id: client.id, exercise_id: ex.id,
          week_num: activeProgram.current_week, set_num: s,
          kg: parseFloat(log.kg), reps_done: parseInt(log.reps) || null
        })
      }
    }
    if (toInsert.length > 0) await supabase.from('weight_logs').insert(toInsert)
    setSaving(false); setSaved(true)
  }

  const totalSets = sessionExercises.reduce((a, ex) => a + (sessionProgressions[ex.id]?.sets || ex.sets), 0)
  const filledSets = sessionExercises.reduce((a, ex) => {
    const sets = sessionProgressions[ex.id]?.sets || ex.sets
    for (let s = 1; s <= sets; s++) if (getLog(ex.id, s).kg) a++
    return a
  }, 0)
  const improved = sessionExercises.reduce((a, ex) => {
    const sets = sessionProgressions[ex.id]?.sets || ex.sets
    for (let s = 1; s <= sets; s++) {
      const l = getLog(ex.id, s); const p = getPrev(ex.name, s)
      if (l.kg && p && parseFloat(l.kg) > parseFloat(String(p))) a++
    }
    return a
  }, 0)

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: '#0C0D10', display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12
    }}>
      <div style={{
        width: 36, height: 36, background: '#B4FF4F', borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="6" width="14" height="4" rx="2" fill="#0C0D10"/>
          <rect x="4" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
          <rect x="9.5" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
        </svg>
      </div>
      <div style={{ color: '#50535C', fontSize: 13 }}>Caricamento...</div>
    </div>
  )

  if (error) return (
    <div style={{
      minHeight: '100vh', background: '#0C0D10', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ color: '#F0F0EE', fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Ops!</div>
        <div style={{ color: '#8A8D96', fontSize: 13 }}>{error}</div>
      </div>
    </div>
  )

  const S = {
    bg: '#0C0D10', surface: '#13151A', surface2: '#1A1D24', surface3: '#21252F',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
    accent: '#B4FF4F', text: '#F0F0EE', text2: '#8A8D96', text3: '#50535C',
    red: '#FF5252', amber: '#FFB84F', blue: '#5B9BFF'
  }

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: '0 auto' }}>

      {/* HEADER */}
      <div style={{
        background: S.surface, borderBottom: `1px solid ${S.border}`,
        padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, background: S.accent, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="6" width="14" height="4" rx="2" fill="#0C0D10"/>
              <rect x="4" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
              <rect x="9.5" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>
            Fit<span style={{ color: S.accent }}>Coach</span>
          </span>
        </div>
        {timer !== null && (
          <div style={{
            background: timerRunning ? 'rgba(180,255,79,0.12)' : S.surface2,
            border: `1px solid ${timerRunning ? 'rgba(180,255,79,0.3)' : S.border2}`,
            borderRadius: 8, padding: '4px 12px',
            fontFamily: 'monospace', fontSize: 16,
            color: timerRunning ? S.accent : S.text2,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            {timerRunning && <div style={{ width: 6, height: 6, borderRadius: '50%', background: S.accent }} />}
            {fmt(timer)}
          </div>
        )}
        <div style={{ fontSize: 13, color: S.text3 }}>
          Sett. {activeProgram?.current_week}/{program?.total_weeks}
        </div>
      </div>

      {/* TAB NAV */}
      <div style={{
        display: 'flex', background: S.surface, borderBottom: `1px solid ${S.border}`
      }}>
        {([['home', 'Home'], ['sessione', 'Allena'], ['programma', 'Programma']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '12px 0', border: 'none', background: 'none',
            borderBottom: tab === t ? `2px solid ${S.accent}` : '2px solid transparent',
            color: tab === t ? S.accent : S.text3,
            fontSize: 13.5, fontWeight: tab === t ? 500 : 400, cursor: 'pointer'
          }}>{label}</button>
        ))}
      </div>

      {/* ===== HOME ===== */}
      {tab === 'home' && (
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: S.text3, marginBottom: 4 }}>
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>
              Ciao, {client?.name?.split(' ')[0]} 👋
            </div>
          </div>

          {/* Card scheda attiva */}
          <div style={{
            background: S.surface, border: `1px solid ${S.border}`,
            borderRadius: 16, padding: 20, marginBottom: 16
          }}>
            <div style={{ fontSize: 11, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Scheda attiva</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{program?.name}</div>
            <div style={{ fontSize: 13, color: S.text2, marginBottom: 16 }}>
              {program?.goal} · {program?.level} · {program?.days_per_week} giorni/sett.
            </div>
            {/* Barra settimane */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: S.text3, marginBottom: 6 }}>
                <span>Progresso mesociclo</span>
                <span>Sett. {activeProgram?.current_week}/{program?.total_weeks}</span>
              </div>
              <div style={{ height: 6, background: S.surface3, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: S.accent, borderRadius: 3,
                  width: `${Math.min((activeProgram?.current_week / program?.total_weeks) * 100, 100)}%`,
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
            {/* Pallini settimane */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {Array.from({ length: program?.total_weeks || 4 }, (_, i) => i + 1).map(w => (
                <div key={w} style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: w < activeProgram?.current_week ? 'rgba(180,255,79,0.2)' :
                    w === activeProgram?.current_week ? S.accent : S.surface2,
                  border: `1px solid ${w === activeProgram?.current_week ? S.accent : S.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600,
                  color: w === activeProgram?.current_week ? '#0C0D10' :
                    w < activeProgram?.current_week ? S.accent : S.text3
                }}>
                  {w < activeProgram?.current_week ? '✓' : w}
                </div>
              ))}
            </div>
          </div>

          {/* Giorni allenamento */}
          <div style={{ fontSize: 11, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Sessioni settimana {activeProgram?.current_week}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {sessions.map((sess, i) => (
              <div key={sess.id}
                onClick={() => { setTab('sessione'); loadSession(sess, activeProgram, client.id, allExercises) }}
                style={{
                  background: S.surface, border: `1px solid ${S.border}`,
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(180,255,79,0.1)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: S.accent, flexShrink: 0
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{sess.name}</div>
                  <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>
                    {(allExercises[sess.id] || []).length} esercizi
                  </div>
                </div>
                <div style={{ color: S.text3, fontSize: 18 }}>→</div>
              </div>
            ))}
          </div>

          {/* Bottone inizia */}
          <button onClick={() => setTab('sessione')} style={{
            width: '100%', background: S.accent, color: '#0C0D10', border: 'none',
            borderRadius: 12, padding: '15px', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '-0.2px'
          }}>▶ Inizia allenamento</button>
        </div>
      )}

      {/* ===== SESSIONE ===== */}
      {tab === 'sessione' && (
        <div style={{ padding: 20 }}>
          {/* Selezione giorno */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {sessions.map((sess) => (
              <button key={sess.id}
                onClick={() => loadSession(sess, activeProgram, client.id, allExercises)}
                style={{
                  flexShrink: 0, padding: '7px 14px', borderRadius: 20, fontSize: 12.5,
                  fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: activeSession?.id === sess.id ? S.accent : S.surface,
                  color: activeSession?.id === sess.id ? '#0C0D10' : S.text2,
                  outline: activeSession?.id === sess.id ? 'none' : `1px solid ${S.border}`
                }}>{sess.name}</button>
            ))}
          </div>

          {/* Stats live */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Completato', value: `${Math.round((filledSets / (totalSets || 1)) * 100)}%`, color: S.text },
              { label: 'Progressioni', value: improved > 0 ? `+${improved}` : '0', color: improved > 0 ? S.accent : S.text3 },
              { label: 'Timer', value: timer !== null ? fmt(timer) : '—', color: timerRunning ? S.accent : S.text3 },
            ].map((s, i) => (
              <div key={i} style={{
                background: S.surface, border: `1px solid ${S.border}`,
                borderRadius: 10, padding: '12px 14px'
              }}>
                <div style={{ fontSize: 10, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 500, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Esercizi */}
          {sessionExercises.map((ex, idx) => {
            const prog = sessionProgressions[ex.id]
            const sets = prog?.sets || ex.sets
            return (
              <div key={ex.id} style={{
                background: S.surface, border: `1px solid ${S.border}`,
                borderRadius: 14, marginBottom: 12, overflow: 'hidden'
              }}>
                {/* Header esercizio */}
                <div style={{ padding: '13px 16px', borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: 'rgba(180,255,79,0.1)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: S.accent, flexShrink: 0
                    }}>{idx + 1}</div>
                    <span style={{ fontWeight: 500, fontSize: 14.5 }}>{prog?.name || ex.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[
                      `${sets} serie`,
                      `${prog?.reps || ex.reps} rep`,
                      `Buffer ${prog?.rir ?? ex.rir}`,
                      ex.rest_seconds ? `Rec. ${Math.floor(ex.rest_seconds / 60)}′${ex.rest_seconds % 60 > 0 ? String(ex.rest_seconds % 60).padStart(2,'0') + '″' : ''}` : null
                    ].filter(Boolean).map((tag: any) => (
                      <span key={tag} style={{
                        background: S.surface2, border: `1px solid ${S.border}`,
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, color: S.text3
                      }}>{tag}</span>
                    ))}
                    {ex.rest_seconds && (
                      <button onClick={() => startTimer(ex.rest_seconds)} style={{
                        background: 'rgba(180,255,79,0.1)', border: 'none',
                        borderRadius: 6, padding: '3px 10px', fontSize: 11,
                        color: S.accent, cursor: 'pointer', fontWeight: 500
                      }}>⏱ Avvia timer</button>
                    )}
                  </div>
                  {prog?.notes && (
                    <div style={{ fontSize: 12, color: S.amber, marginTop: 8, fontStyle: 'italic' }}>
                      💡 {prog.notes}
                    </div>
                  )}
                </div>

                {/* Header colonne */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '32px 1fr 100px 80px 52px',
                  padding: '6px 16px', background: S.surface2, gap: 6
                }}>
                  {['Set', 'Sett. scorsa', 'Kg', 'Reps', '+/−'].map(h => (
                    <span key={h} style={{ fontSize: 10, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                  ))}
                </div>

                {/* Righe set */}
                {Array.from({ length: sets }, (_, i) => i + 1).map(setNum => {
                  const log = getLog(ex.id, setNum)
                  const prev = getPrev(prog?.name || ex.name, setNum)
                  const delta = log.kg && prev ? parseFloat(log.kg) - parseFloat(String(prev)) : null
                  const isUp = delta !== null && delta > 0
                  const isDown = delta !== null && delta < 0

                  return (
                    <div key={setNum} style={{
                      display: 'grid', gridTemplateColumns: '32px 1fr 100px 80px 52px',
                      alignItems: 'center', padding: '9px 16px', gap: 6,
                      borderTop: `1px solid ${S.border}`,
                      background: isUp ? 'rgba(180,255,79,0.03)' : 'transparent'
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: S.text3 }}>{setNum}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, color: S.text2 }}>
                        {prev ? `${prev}kg` : '—'}
                      </span>
                      <input type="number" step="0.5" min="0"
                        placeholder={prev ? String(prev) : 'kg'}
                        value={log.kg}
                        onChange={e => setLog(ex.id, setNum, 'kg', e.target.value)}
                        style={{
                          background: S.surface2,
                          border: `1px solid ${isUp ? 'rgba(180,255,79,0.6)' : isDown ? 'rgba(255,82,82,0.4)' : S.border2}`,
                          borderRadius: 8, padding: '7px', color: S.text,
                          fontFamily: 'monospace', fontSize: 15, textAlign: 'center',
                          outline: 'none', width: '100%'
                        }}
                      />
                      <input type="number" step="1" min="1" max="50"
                        placeholder={prog?.reps?.split('-')[0] || ex.reps?.split('-')[0] || '—'}
                        value={log.reps}
                        onChange={e => setLog(ex.id, setNum, 'reps', e.target.value)}
                        style={{
                          background: S.surface2, border: `1px solid ${S.border2}`,
                          borderRadius: 8, padding: '7px', color: S.text,
                          fontFamily: 'monospace', fontSize: 15, textAlign: 'center',
                          outline: 'none', width: '100%'
                        }}
                      />
                      <span style={{
                        fontFamily: 'monospace', fontSize: 13, fontWeight: 600, textAlign: 'right',
                        color: isUp ? S.accent : isDown ? S.red : S.text3
                      }}>
                        {delta === null ? '—' : isUp ? `+${delta}` : delta === 0 ? '=' : String(delta)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {sessionExercises.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: S.text3, fontSize: 13 }}>
              Seleziona un giorno per iniziare
            </div>
          )}

          {sessionExercises.length > 0 && (
            <button onClick={saveSession} disabled={saving || saved || filledSets === 0} style={{
              width: '100%', marginTop: 8, padding: '15px',
              background: saved ? 'transparent' : filledSets === 0 ? S.surface : S.accent,
              color: saved ? S.accent : filledSets === 0 ? S.text3 : '#0C0D10',
              border: saved ? `1px solid ${S.accent}` : '1px solid transparent',
              borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: filledSets === 0 ? 'not-allowed' : 'pointer'
            }}>
              {saved ? '✓ Sessione salvata! Ottimo lavoro!' :
                saving ? 'Salvataggio...' :
                  filledSets === 0 ? 'Inserisci almeno un peso' :
                    `Salva sessione — ${filledSets}/${totalSets} serie`}
            </button>
          )}
        </div>
      )}

      {/* ===== PROGRAMMA ===== */}
      {tab === 'programma' && (
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{program?.name}</div>
            <div style={{ fontSize: 13, color: S.text2 }}>
              {program?.total_weeks} settimane · {program?.days_per_week} giorni/sett. · {program?.goal}
            </div>
          </div>

          {/* Tab settimane */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
            {Array.from({ length: program?.total_weeks || 4 }, (_, i) => i + 1).map(w => {
              const isDeload = w === program?.total_weeks
              const isCurrent = w === activeProgram?.current_week
              return (
                <button key={w}
                  onClick={() => setProgramWeek(w)}
                  style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 12.5,
                    fontWeight: isCurrent ? 600 : 400, border: 'none', cursor: 'pointer',
                    background: isCurrent ? S.accent : S.surface,
                    color: isCurrent ? '#0C0D10' : isDeload ? S.amber : S.text2,
                    outline: isCurrent ? 'none' : `1px solid ${S.border}`
                  }}>
                  {isDeload ? `Sett. ${w} 🔄` : `Sett. ${w}`}
                  {isCurrent && ' ●'}
                </button>
              )
            })}
          </div>

          {programWeek === program?.total_weeks && (
            <div style={{
              background: 'rgba(255,184,79,0.1)', border: '1px solid rgba(255,184,79,0.3)',
              borderRadius: 8, padding: '10px 14px', fontSize: 12, color: S.amber, marginBottom: 16
            }}>🔄 Settimana di scarico — volume ridotto, stessi carichi</div>
          )}

          {sessions.map((sess) => {
            const exs = allExercises[sess.id] || []
            const progs = allProgressions[sess.id] || []
            return (
              <div key={sess.id} style={{
                background: S.surface, border: `1px solid ${S.border}`,
                borderRadius: 14, marginBottom: 12, overflow: 'hidden'
              }}>
                <div style={{ padding: '13px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{sess.name}</span>
                  <span style={{ fontSize: 12, color: S.text3 }}>{exs.length} esercizi</span>
                </div>
                {exs.map((ex: any, idx: number) => {
                  const weekProg = progs.find((p: any) => p.exercise_id === ex.id && p.week_num === programWeek)
                  return (
                    <div key={ex.id} style={{
                      padding: '11px 16px', borderTop: idx > 0 ? `1px solid ${S.border}` : 'none',
                      display: 'grid', gridTemplateColumns: '24px 1fr auto'
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: S.text3, paddingTop: 2 }}>{idx + 1}</span>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: S.text }}>
                          {weekProg?.name || ex.name}
                        </div>
                        {weekProg?.notes && (
                          <div style={{ fontSize: 11.5, color: S.amber, marginTop: 3, fontStyle: 'italic' }}>
                            {weekProg.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: S.accent }}>
                          {weekProg?.sets || ex.sets}×{weekProg?.reps || ex.reps}
                        </span>
                        <div style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>
                          Buffer {weekProg?.rir ?? ex.rir}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* PDF Button */}
          <button onClick={() => window.open(`/cliente/${token}/pdf`, '_blank')} style={{
            width: '100%', marginTop: 8, background: S.surface,
            border: `1px solid ${S.border2}`, borderRadius: 12,
            padding: '13px', fontSize: 14, fontWeight: 500,
            color: S.text2, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            📄 Scarica PDF scheda
          </button>
        </div>
      )}
    </div>
  )
}