'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const GIORNI = ['Day 1 — Gambe', 'Day 2 — Petto e Braccia', 'Day 3 — Schiena e Spalle']

export default function Sessione() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams()
  const [client, setClient] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [exercises, setExercises] = useState<any[]>([])
  const [weekNum, setWeekNum] = useState(1)
  const [logs, setLogs] = useState<Record<string, { kg: string; reps: string }>>({})
  const [prevLogs, setPrevLogs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [timer, setTimer] = useState<number | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('clients').select('*').eq('id', id).single()
      setClient(c)
      const { data: sess } = await supabase
        .from('sessions')
        .select('*')
        .order('day_index')
      setSessions(sess || [])
      if (sess && sess.length > 0) loadSession(sess[0], 1)
    }
    load()
  }, [id])

  async function loadSession(sess: any, week: number) {
    setActiveSession(sess)
    setSaved(false)
    setLogs({})
    const { data: exs } = await supabase
      .from('exercises')
      .select('*')
      .eq('session_id', sess.id)
      .order('sort_order')
    setExercises(exs || [])

    const { data: prev } = await supabase
      .from('weight_logs')
      .select('*, exercises(name)')
      .eq('client_id', id)
      .eq('week_num', week - 1)
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
    setTimer(seconds)
    setTimerRunning(true)
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t === null || t <= 1) { clearInterval(timerRef.current); setTimerRunning(false); return 0 }
        return t - 1
      })
    }, 1000)
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  async function saveSessione() {
    setSaving(true)
    const toInsert: any[] = []
    for (const ex of exercises) {
      for (let s = 1; s <= ex.sets; s++) {
        const log = getLog(ex.id, s)
        if (log.kg) {
          toInsert.push({
            client_id: id,
            exercise_id: ex.id,
            week_num: weekNum,
            set_num: s,
            kg: parseFloat(log.kg),
            reps_done: parseInt(log.reps) || null,
          })
        }
      }
    }
    if (toInsert.length > 0) await supabase.from('weight_logs').insert(toInsert)
    setSaving(false)
    setSaved(true)
    setTimeout(() => router.push(`/dashboard/clienti/${id}`), 1800)
  }

  // Stats live
  const totalSets = exercises.reduce((a, e) => a + e.sets, 0)
  const filledSets = exercises.reduce((a, ex) => {
    for (let s = 1; s <= ex.sets; s++) if (getLog(ex.id, s).kg) a++
    return a
  }, 0)
  const improved = exercises.reduce((a, ex) => {
    for (let s = 1; s <= ex.sets; s++) {
      const l = getLog(ex.id, s); const p = getPrev(ex.name, s)
      if (l.kg && p && parseFloat(l.kg) > p) a++
    }
    return a
  }, 0)
  const pct = totalSets > 0 ? Math.round((filledSets / totalSets) * 100) : 0

  if (!client) return <div style={{ padding: 40, color: 'var(--text3)', fontFamily: 'var(--font-syne)' }}>Caricamento...</div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* TOPBAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.back()} style={{
            background: 'none', border: 'none', color: 'var(--text3)',
            cursor: 'pointer', fontSize: 13, padding: 0
          }}>← Indietro</button>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 16 }}>
              {client.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
              {activeSession?.name || '—'} · Settimana {weekNum}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Timer recupero */}
          {timer !== null && (
            <div style={{
              background: timerRunning ? 'rgba(180,255,79,0.12)' : 'var(--surface2)',
              border: `1px solid ${timerRunning ? 'rgba(180,255,79,0.3)' : 'var(--border2)'}`,
              borderRadius: 8, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: timerRunning ? 'var(--accent)' : 'var(--text3)',
                animation: timerRunning ? 'pulse 1s infinite' : 'none'
              }} />
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 16, color: timerRunning ? 'var(--accent)' : 'var(--text2)' }}>
                {formatTime(timer ?? 0)}
              </span>
            </div>
          )}

          {/* Sett. nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '4px 8px' }}>
            <button onClick={() => { const w = Math.max(1, weekNum - 1); setWeekNum(w); if (activeSession) loadSession(activeSession, w) }} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>←</button>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: 'var(--text)', minWidth: 60, textAlign: 'center' }}>Sett. {weekNum}</span>
            <button onClick={() => { const w = weekNum + 1; setWeekNum(w); if (activeSession) loadSession(activeSession, w) }} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>→</button>
          </div>

          <button onClick={saveSessione} disabled={saving || saved || filledSets === 0} style={{
            background: saved ? 'transparent' : filledSets === 0 ? 'var(--surface2)' : 'var(--accent)',
            color: saved ? 'var(--accent)' : filledSets === 0 ? 'var(--text3)' : '#0C0D10',
            border: saved ? '1px solid var(--accent)' : '1px solid transparent',
            borderRadius: 8, padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: filledSets === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}>
            {saved ? '✓ Salvato!' : saving ? 'Salvataggio...' : 'Salva sessione'}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>

        {/* TAB GIORNI */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {sessions.map(sess => (
            <button key={sess.id}
              onClick={() => { setActiveSession(sess); loadSession(sess, weekNum) }}
              style={{
                flexShrink: 0, padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: activeSession?.id === sess.id ? 'var(--accent)' : 'var(--surface)',
                color: activeSession?.id === sess.id ? '#0C0D10' : 'var(--text2)',
                outline: activeSession?.id === sess.id ? 'none' : '1px solid var(--border)'
              }}>
              {sess.name}
            </button>
          ))}
        </div>

        {/* STATS LIVE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Completato', value: `${pct}%`, color: pct === 100 ? 'var(--accent)' : 'var(--text)' },
            { label: 'Serie inserite', value: `${filledSets}/${totalSets}`, color: 'var(--text)' },
            { label: 'Progressioni', value: improved > 0 ? `+${improved}` : '0', color: improved > 0 ? 'var(--accent)' : 'var(--text3)' },
            { label: 'Recupero', value: timer !== null ? formatTime(timer) : '—', color: timerRunning ? 'var(--accent)' : 'var(--text3)' },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px 16px'
            }}>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 22, fontWeight: 500, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ESERCIZI */}
        {exercises.map((ex, exIdx) => (
          <div key={ex.id} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, marginBottom: 12, overflow: 'hidden',
            transition: 'border-color 0.2s',
          }}>
            {/* Header esercizio */}
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(180,255,79,0.1)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: 'var(--accent)'
                }}>{exIdx + 1}</div>
                <span style={{ fontWeight: 500, fontSize: 14.5, color: 'var(--text)' }}>{ex.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[
                  `${ex.sets} serie`,
                  `${ex.reps} rep`,
                  `Buffer ${ex.rir}`,
                  ex.rest_seconds ? `${Math.floor(ex.rest_seconds / 60)}′${ex.rest_seconds % 60 > 0 ? String(ex.rest_seconds % 60).padStart(2,'0') + '″' : ''}` : null
                ].filter(Boolean).map((tag: any) => (
                  <span key={tag} style={{
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '3px 9px', fontSize: 11, color: 'var(--text3)'
                  }}>{tag}</span>
                ))}
                {/* Bottone avvia timer */}
                {ex.rest_seconds && (
                  <button
                    onClick={() => startTimer(ex.rest_seconds)}
                    title="Avvia timer recupero"
                    style={{
                      background: 'var(--surface2)', border: '1px solid var(--border2)',
                      borderRadius: 6, padding: '4px 10px', fontSize: 11,
                      color: 'var(--accent)', cursor: 'pointer', fontWeight: 500
                    }}>⏱ Recupero</button>
                )}
              </div>
            </div>

            {/* Header colonne */}
            <div style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 130px 130px 70px',
              padding: '7px 18px', background: 'var(--surface2)',
              borderBottom: '1px solid var(--border)'
            }}>
              {['Set', 'Settimana scorsa', 'Kg oggi', 'Reps', '+/−'].map(h => (
                <span key={h} style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
              ))}
            </div>

            {/* Righe set */}
            {Array.from({ length: ex.sets }, (_, i) => i + 1).map(setNum => {
              const log = getLog(ex.id, setNum)
              const prev = getPrev(ex.name, setNum)
              const delta = log.kg && prev ? parseFloat(log.kg) - prev : null
              const isImproved = delta !== null && delta > 0
              const isSame = delta === 0
              const isWorse = delta !== null && delta < 0

              return (
                <div key={setNum} style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr 130px 130px 70px',
                  alignItems: 'center', padding: '9px 18px',
                  borderTop: '1px solid var(--border)',
                  background: isImproved ? 'rgba(180,255,79,0.03)' : 'transparent',
                  transition: 'background 0.2s'
                }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: 'var(--text3)' }}>{setNum}</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {prev ? (
                      <>
                        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 14, color: 'var(--text2)' }}>{prev} kg</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>× {log.reps || '?'}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Prima volta</span>
                    )}
                  </div>

                  <div>
                    <input
                      type="number" step="0.5" min="0"
                      placeholder={prev ? String(prev) : 'kg'}
                      value={log.kg}
                      onChange={e => setLog(ex.id, setNum, 'kg', e.target.value)}
                      style={{
                        width: 110, background: 'var(--surface2)',
                        border: `1px solid ${isImproved ? 'rgba(180,255,79,0.6)' : isSame ? 'var(--border2)' : isWorse ? 'rgba(255,82,82,0.4)' : 'var(--border2)'}`,
                        borderRadius: 8, padding: '7px 10px', color: 'var(--text)',
                        fontFamily: 'var(--font-dm-mono)', fontSize: 15,
                        textAlign: 'center', outline: 'none', transition: 'border-color 0.2s'
                      }}
                    />
                  </div>

                  <div>
                    <input
                      type="number" step="1" min="1" max="50"
                      placeholder={ex.reps}
                      value={log.reps}
                      onChange={e => setLog(ex.id, setNum, 'reps', e.target.value)}
                      style={{
                        width: 90, background: 'var(--surface2)', border: '1px solid var(--border2)',
                        borderRadius: 8, padding: '7px 10px', color: 'var(--text)',
                        fontFamily: 'var(--font-dm-mono)', fontSize: 15,
                        textAlign: 'center', outline: 'none'
                      }}
                    />
                  </div>

                  <span style={{
                    fontFamily: 'var(--font-dm-mono)', fontSize: 14, fontWeight: 600,
                    color: isImproved ? 'var(--accent)' : isSame ? 'var(--text3)' : isWorse ? 'var(--red)' : 'var(--text3)'
                  }}>
                    {delta === null ? '—' : isImproved ? `+${delta}` : isSame ? '=' : String(delta)}
                  </span>
                </div>
              )
            })}
          </div>
        ))}

        {/* BOTTONE SALVA */}
        {exercises.length > 0 && (
          <button onClick={saveSessione} disabled={saving || saved || filledSets === 0} style={{
            width: '100%', marginTop: 8, padding: '15px',
            background: saved ? 'transparent' : filledSets === 0 ? 'var(--surface)' : 'var(--accent)',
            color: saved ? 'var(--accent)' : filledSets === 0 ? 'var(--text3)' : '#0C0D10',
            border: saved ? '1px solid var(--accent)' : '1px solid transparent',
            borderRadius: 12, fontSize: 15, fontWeight: 700,
            fontFamily: 'var(--font-syne)', cursor: filledSets === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}>
            {saved ? '✓ Sessione salvata! Ottimo lavoro.' : saving ? 'Salvataggio...' : filledSets === 0 ? 'Inserisci almeno un peso per salvare' : `Salva sessione — ${filledSets} serie completate`}
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}