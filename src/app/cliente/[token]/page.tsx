'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'

type Tab = 'home' | 'allena' | 'programma' | 'progressi'

export default function ClienteApp() {
  const supabase = createClient()
  const { token } = useParams()
  const [tab, setTab] = useState<Tab>('home')
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
  const [allLogs, setAllLogs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [timer, setTimer] = useState<number | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [programWeek, setProgramWeek] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const timerRef = useRef<any>(null)

  const S = {
    bg: '#0C0D10', surface: '#13151A', surface2: '#1A1D24', surface3: '#21252F',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
    accent: '#B4FF4F', text: '#F0F0EE', text2: '#8A8D96', text3: '#50535C',
    red: '#FF5252', amber: '#FFB84F', blue: '#5B9BFF'
  }

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
    setProgramWeek(cp.current_week)

    const { data: sess } = await supabase
      .from('sessions').select('*').eq('program_id', cp.program_id).order('day_index')
    setSessions(sess || [])

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

    // Carica tutti i log per storico
    const { data: logs } = await supabase
      .from('weight_logs')
      .select('*, exercises(name)')
      .eq('client_id', c.id)
      .order('logged_at', { ascending: false })
    setAllLogs(logs || [])

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
    if (toInsert.length > 0) {
      await supabase.from('weight_logs').insert(toInsert)
      const { data: newLogs } = await supabase
        .from('weight_logs').select('*, exercises(name)')
        .eq('client_id', client.id).order('logged_at', { ascending: false })
      setAllLogs(newLogs || [])
    }
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

  // Statistiche storico
  const totalSessions = new Set(allLogs.map(l => l.logged_at?.slice(0, 10))).size
  const totalVolume = allLogs.reduce((a, l) => a + (l.kg || 0), 0)
  const prPersonali = Object.values(
    allLogs.reduce((acc: any, l) => {
      const name = l.exercises?.name
      if (!name) return acc
      if (!acc[name] || l.kg > acc[name].kg) acc[name] = l
      return acc
    }, {})
  ) as any[]

  // Storico per esercizio
  const storicoPerEsercizio = allLogs.reduce((acc: any, l) => {
    const name = l.exercises?.name || 'Sconosciuto'
    if (!acc[name]) acc[name] = []
    acc[name].push(l)
    return acc
  }, {})

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 40, height: 40, background: S.accent, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="6" width="14" height="4" rx="2" fill="#0C0D10"/>
          <rect x="4" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
          <rect x="9.5" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
        </svg>
      </div>
      <div style={{ color: S.text3, fontSize: 13 }}>Caricamento...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: S.text, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Ops!</div>
        <div style={{ color: S.text2, fontSize: 13 }}>{error}</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text, fontFamily: "'DM Sans', sans-serif", maxWidth: 500, margin: '0 auto' }}>

      {/* HEADER */}
      <div style={{
        background: S.surface, borderBottom: `1px solid ${S.border}`,
        padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: S.accent, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {timer !== null && (
            <div style={{
              background: timerRunning ? 'rgba(180,255,79,0.12)' : S.surface2,
              border: `1px solid ${timerRunning ? 'rgba(180,255,79,0.3)' : S.border2}`,
              borderRadius: 8, padding: '4px 12px', fontFamily: 'monospace', fontSize: 16,
              color: timerRunning ? S.accent : S.text2, display: 'flex', alignItems: 'center', gap: 6
            }}>
              {timerRunning && <div style={{ width: 6, height: 6, borderRadius: '50%', background: S.accent }} />}
              {fmt(timer)}
            </div>
          )}
          <div style={{ fontSize: 12, color: S.text3 }}>Sett. {activeProgram?.current_week}/{program?.total_weeks}</div>
        </div>
      </div>

      {/* TAB NAV */}
      <div style={{ display: 'flex', background: S.surface, borderBottom: `1px solid ${S.border}` }}>
        {([['home', '🏠', 'Home'], ['allena', '💪', 'Allena'], ['programma', '📋', 'Programma'], ['progressi', '📊', 'Progressi']] as const).map(([t, icon, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'none',
            borderBottom: tab === t ? `2px solid ${S.accent}` : '2px solid transparent',
            color: tab === t ? S.accent : S.text3,
            fontSize: 11, fontWeight: tab === t ? 500 : 400, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
          }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ===== HOME ===== */}
      {tab === 'home' && (
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 4 }}>
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' }}>
              Ciao, {client?.name?.split(' ')[0]} 👋
            </div>
          </div>

          {/* Card scheda attiva */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Scheda attiva</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>{program?.name}</div>
            <div style={{ fontSize: 13, color: S.text2, marginBottom: 16 }}>
              {program?.goal} · {program?.level} · {program?.days_per_week} giorni/sett.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: S.text3, marginBottom: 6 }}>
              <span>Progresso mesociclo</span>
              <span>Sett. {activeProgram?.current_week}/{program?.total_weeks}</span>
            </div>
            <div style={{ height: 6, background: S.surface3, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{
                height: '100%', background: S.accent, borderRadius: 3,
                width: `${Math.min((activeProgram?.current_week / program?.total_weeks) * 100, 100)}%`
              }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Array.from({ length: program?.total_weeks || 4 }, (_, i) => i + 1).map(w => (
                <div key={w} style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: w < activeProgram?.current_week ? 'rgba(180,255,79,0.2)' : w === activeProgram?.current_week ? S.accent : S.surface2,
                  border: `1px solid ${w === activeProgram?.current_week ? S.accent : S.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
                  color: w === activeProgram?.current_week ? '#0C0D10' : w < activeProgram?.current_week ? S.accent : S.text3
                }}>
                  {w < activeProgram?.current_week ? '✓' : w}
                </div>
              ))}
            </div>
          </div>

          {/* Stats rapide */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Sessioni', value: totalSessions },
              { label: 'PR personali', value: prPersonali.length },
              { label: 'Kg totali', value: Math.round(totalVolume) },
            ].map((s, i) => (
              <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 500, color: i === 1 ? S.accent : S.text }}>{s.value}</div>
                <div style={{ fontSize: 11, color: S.text3, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Giorni */}
          <div style={{ fontSize: 11, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Sessioni questa settimana
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {sessions.map((sess, i) => (
              <div key={sess.id}
                onClick={() => { setTab('allena'); loadSession(sess, activeProgram, client.id, allExercises) }}
                style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(180,255,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: S.accent, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{sess.name}</div>
                  <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>{(allExercises[sess.id] || []).length} esercizi</div>
                </div>
                <div style={{ color: S.text3, fontSize: 20 }}>›</div>
              </div>
            ))}
          </div>

          <button onClick={() => setTab('allena')} style={{
            width: '100%', background: S.accent, color: '#0C0D10', border: 'none',
            borderRadius: 12, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer'
          }}>💪 Inizia allenamento</button>
        </div>
      )}

      {/* ===== ALLENA ===== */}
      {tab === 'allena' && (
        <div style={{ padding: 20 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Completato', value: `${Math.round((filledSets / (totalSets || 1)) * 100)}%` },
              { label: 'Progressioni', value: improved > 0 ? `+${improved}` : '0', color: improved > 0 ? S.accent : S.text3 },
              { label: 'Timer', value: timer !== null ? fmt(timer) : '—', color: timerRunning ? S.accent : S.text3 },
            ].map((s, i) => (
              <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 500, color: (s as any).color || S.text }}>{s.value}</div>
              </div>
            ))}
          </div>

          {sessionExercises.map((ex, idx) => {
            const prog = sessionProgressions[ex.id]
            const sets = prog?.sets || ex.sets
            return (
              <div key={ex.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(180,255,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: S.accent, flexShrink: 0 }}>{idx + 1}</div>
                    <span style={{ fontWeight: 500, fontSize: 14.5 }}>{prog?.name || ex.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[`${sets} serie`, `${prog?.reps || ex.reps} rep`, `Buffer ${prog?.rir ?? ex.rir}`].map(tag => (
                      <span key={tag} style={{ background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, color: S.text3 }}>{tag}</span>
                    ))}
                    {ex.rest_seconds && (
                      <button onClick={() => startTimer(ex.rest_seconds)} style={{ background: 'rgba(180,255,79,0.1)', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: S.accent, cursor: 'pointer', fontWeight: 500 }}>⏱ Timer</button>
                    )}
                  </div>
                  {prog?.notes && <div style={{ fontSize: 12, color: S.amber, marginTop: 8, fontStyle: 'italic' }}>💡 {prog.notes}</div>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 90px 72px 44px', padding: '6px 14px', background: S.surface2, gap: 6 }}>
                  {['Set', 'Sett. scorsa', 'Kg', 'Reps', '+/−'].map(h => (
                    <span key={h} style={{ fontSize: 9.5, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                  ))}
                </div>

                {Array.from({ length: sets }, (_, i) => i + 1).map(setNum => {
                  const log = getLog(ex.id, setNum)
                  const prev = getPrev(prog?.name || ex.name, setNum)
                  const delta = log.kg && prev ? parseFloat(log.kg) - parseFloat(String(prev)) : null
                  const isUp = delta !== null && delta > 0
                  const isDown = delta !== null && delta < 0
                  return (
                    <div key={setNum} style={{
                      display: 'grid', gridTemplateColumns: '28px 1fr 90px 72px 44px',
                      alignItems: 'center', padding: '8px 14px', gap: 6,
                      borderTop: `1px solid ${S.border}`,
                      background: isUp ? 'rgba(180,255,79,0.03)' : 'transparent'
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: S.text3 }}>{setNum}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: S.text2 }}>{prev ? `${prev}kg` : '—'}</span>
                      <input type="number" step="0.5" min="0"
                        placeholder={prev ? String(prev) : 'kg'}
                        value={log.kg}
                        onChange={e => setLog(ex.id, setNum, 'kg', e.target.value)}
                        style={{
                          background: S.surface2,
                          border: `1px solid ${isUp ? 'rgba(180,255,79,0.6)' : isDown ? 'rgba(255,82,82,0.4)' : S.border2}`,
                          borderRadius: 8, padding: '7px', color: S.text,
                          fontFamily: 'monospace', fontSize: 14, textAlign: 'center', outline: 'none', width: '100%'
                        }}
                      />
                      <input type="number" step="1" min="1" max="50"
                        placeholder="rep"
                        value={log.reps}
                        onChange={e => setLog(ex.id, setNum, 'reps', e.target.value)}
                        style={{
                          background: S.surface2, border: `1px solid ${S.border2}`,
                          borderRadius: 8, padding: '7px', color: S.text,
                          fontFamily: 'monospace', fontSize: 14, textAlign: 'center', outline: 'none', width: '100%'
                        }}
                      />
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, textAlign: 'right', color: isUp ? S.accent : isDown ? S.red : S.text3 }}>
                        {delta === null ? '—' : isUp ? `+${delta}` : delta === 0 ? '=' : String(delta)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {sessionExercises.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: S.text3, fontSize: 13 }}>Seleziona un giorno</div>
          )}

          {sessionExercises.length > 0 && (
            <button onClick={saveSession} disabled={saving || saved || filledSets === 0} style={{
              width: '100%', marginTop: 8, padding: '15px',
              background: saved ? 'transparent' : filledSets === 0 ? S.surface : S.accent,
              color: saved ? S.accent : filledSets === 0 ? S.text3 : '#0C0D10',
              border: saved ? `1px solid ${S.accent}` : '1px solid transparent',
              borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: filledSets === 0 ? 'not-allowed' : 'pointer'
            }}>
              {saved ? '✓ Sessione salvata! Ottimo lavoro!' : saving ? 'Salvataggio...' : filledSets === 0 ? 'Inserisci almeno un peso' : `Salva — ${filledSets}/${totalSets} serie`}
            </button>
          )}
        </div>
      )}

      {/* ===== PROGRAMMA ===== */}
      {tab === 'programma' && (
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{program?.name}</div>
            <div style={{ fontSize: 13, color: S.text2 }}>{program?.total_weeks} settimane · {program?.days_per_week} giorni/sett.</div>
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
            {Array.from({ length: program?.total_weeks || 4 }, (_, i) => i + 1).map(w => {
              const isDeload = w === program?.total_weeks
              const isCurrent = w === activeProgram?.current_week
              const isSelected = w === programWeek
              return (
                <button key={w} onClick={() => setProgramWeek(w)} style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 12.5,
                  fontWeight: isSelected ? 600 : 400, border: 'none', cursor: 'pointer',
                  background: isSelected ? S.accent : S.surface,
                  color: isSelected ? '#0C0D10' : isDeload ? S.amber : S.text2,
                  outline: isSelected ? 'none' : `1px solid ${S.border}`
                }}>
                  Sett. {w}{isCurrent ? ' ●' : ''}{isDeload ? ' 🔄' : ''}
                </button>
              )
            })}
          </div>

          {programWeek === program?.total_weeks && (
            <div style={{ background: 'rgba(255,184,79,0.1)', border: '1px solid rgba(255,184,79,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: S.amber, marginBottom: 16 }}>
              🔄 Settimana di scarico — volume ridotto, stessi carichi
            </div>
          )}

          {sessions.map((sess) => {
            const exs = allExercises[sess.id] || []
            const progs = allProgressions[sess.id] || []
            return (
              <div key={sess.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{sess.name}</span>
                  <span style={{ fontSize: 11, color: S.text3 }}>{exs.length} esercizi</span>
                </div>
                {exs.map((ex: any, idx: number) => {
                  const wp = progs.find((p: any) => p.exercise_id === ex.id && p.week_num === programWeek)
                  return (
                    <div key={ex.id} style={{ padding: '11px 16px', borderTop: idx > 0 ? `1px solid ${S.border}` : 'none', display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: 8, alignItems: 'start' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: S.text3, paddingTop: 3 }}>{idx + 1}</span>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{wp?.name || ex.name}</div>
                        {wp?.notes && <div style={{ fontSize: 11, color: S.amber, marginTop: 3, fontStyle: 'italic' }}>💡 {wp.notes}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, color: S.accent, fontWeight: 600 }}>{wp?.sets || ex.sets}×{wp?.reps || ex.reps}</div>
                        <div style={{ fontSize: 10, color: S.text3, marginTop: 2 }}>Buffer {wp?.rir ?? ex.rir}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          <button onClick={() => window.open(`/cliente/${token}/pdf`, '_blank')} style={{
            width: '100%', marginTop: 8, background: S.surface, border: `1px solid ${S.border2}`,
            borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 500,
            color: S.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            📄 Scarica PDF scheda completa
          </button>
        </div>
      )}

      {/* ===== PROGRESSI ===== */}
      {tab === 'progressi' && (
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>I tuoi progressi</div>

          {/* Stats generali */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Sessioni totali', value: totalSessions, color: S.text },
              { label: 'Esercizi loggati', value: allLogs.length, color: S.text },
              { label: 'Record personali', value: prPersonali.length, color: S.accent },
              { label: 'Kg totali sollevati', value: `${Math.round(totalVolume).toLocaleString()}`, color: S.accent },
            ].map((s, i) => (
              <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px' }}>
                <div style={{ fontSize: 10, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 500, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* PR Personali */}
          {prPersonali.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                🏆 Record personali
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {prPersonali.sort((a: any, b: any) => b.kg - a.kg).slice(0, 10).map((pr: any) => (
                  <div key={pr.id} style={{
                    background: S.surface, border: `1px solid ${S.border}`,
                    borderRadius: 10, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{pr.exercises?.name}</div>
                      <div style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>
                        Sett. {pr.week_num} · {new Date(pr.logged_at).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: S.accent }}>{pr.kg} kg</div>
                      {pr.reps_done && <div style={{ fontSize: 11, color: S.text3 }}>× {pr.reps_done} rep</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Storico per esercizio */}
          {Object.keys(storicoPerEsercizio).length > 0 && (
            <>
              <div style={{ fontSize: 11, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                📈 Storico pesi
              </div>
              {Object.entries(storicoPerEsercizio).slice(0, 8).map(([name, exLogs]: [string, any]) => (
                <div key={name} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 10 }}>{name}</div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {exLogs.slice(0, 8).reverse().map((log: any, i: number) => {
                      const maxKg = Math.max(...exLogs.map((l: any) => l.kg || 0))
                      const h = maxKg > 0 ? Math.round((log.kg / maxKg) * 48) + 12 : 12
                      return (
                        <div key={log.id} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ fontSize: 10, color: log.kg === maxKg ? S.accent : S.text3, fontFamily: 'monospace' }}>{log.kg}</div>
                          <div style={{ width: 24, height: h, background: log.kg === maxKg ? S.accent : S.surface3, borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                          <div style={{ fontSize: 9, color: S.text3 }}>S{log.week_num}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {allLogs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              <div style={{ color: S.text3, fontSize: 13 }}>Nessun dato ancora — inizia ad allenarti!</div>
              <button onClick={() => setTab('allena')} style={{
                marginTop: 16, background: S.accent, color: '#0C0D10',
                border: 'none', borderRadius: 8, padding: '9px 20px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>Inizia ora →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}