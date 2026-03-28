'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'

type Tab = 'home' | 'allena' | 'programma' | 'progressi' | 'profilo'

export default function ClienteApp() {
  const supabase = createClient()
  const { token } = useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Profilo
  const [measurements, setMeasurements] = useState<any[]>([])
  const [photos, setPhotos] = useState<any[]>([])
  const [addingMeasurement, setAddingMeasurement] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().slice(0, 10))
  const [profiloTab, setProfiloTab] = useState<'peso' | 'misurazioni' | 'foto'>('peso')
  const [newMeasurement, setNewMeasurement] = useState({
    measured_at: new Date().toISOString().slice(0, 10),
    weight: '', neck: '', shoulders: '', chest: '',
    waist: '', abdomen: '', hips: '',
    arm_right: '', arm_left: '', forearm_right: '', forearm_left: '',
    thigh_right: '', thigh_left: '', calf_right: '', calf_left: '',
    notes: ''
  })
  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')

  const S = {
    bg: '#0C0D10', surface: '#13151A', surface2: '#1A1D24', surface3: '#21252F',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
    accent: '#B4FF4F', text: '#F0F0EE', text2: '#8A8D96', text3: '#50535C',
    red: '#FF5252', amber: '#FFB84F', blue: '#5B9BFF'
  }

  useEffect(() => { load() }, [token])

  async function load() {
    const { data: c } = await supabase.from('clients').select('*').eq('access_token', token).single()
    if (!c) { setError('Link non valido. Contatta il tuo trainer.'); setLoading(false); return }
    setClient(c)

    const { data: cp } = await supabase.from('client_programs')
      .select('*, programs(*)').eq('client_id', c.id).eq('is_active', true).single()
    if (!cp) { setError('Nessuna scheda assegnata. Contatta il tuo trainer.'); setLoading(false); return }
    setActiveProgram(cp); setProgram(cp.programs); setProgramWeek(cp.current_week)

    const { data: sess } = await supabase.from('sessions')
      .select('*').eq('program_id', cp.program_id).order('day_index')
    setSessions(sess || [])

    const exMap: Record<string, any[]> = {}
    const progMap: Record<string, any[]> = {}
    for (const s of sess || []) {
      const { data: exs } = await supabase.from('exercises').select('*').eq('session_id', s.id).order('sort_order')
      exMap[s.id] = exs || []
      if (exs?.length) {
        const { data: progs } = await supabase.from('week_progressions').select('*')
          .in('exercise_id', exs.map((e: any) => e.id)).order('week_num')
        progMap[s.id] = progs || []
      }
    }
    setAllExercises(exMap); setAllProgressions(progMap)

    const { data: logsData } = await supabase.from('weight_logs')
      .select('*, exercises(name, week_progressions(name, week_num))')
      .eq('client_id', c.id).order('logged_at', { ascending: false })
    setAllLogs(logsData || [])

    const { data: m } = await supabase.from('measurements')
      .select('*').eq('client_id', c.id).order('measured_at', { ascending: false })
    setMeasurements(m || [])

    const { data: ph } = await supabase.from('progress_photos')
      .select('*').eq('client_id', c.id).order('photo_date', { ascending: false })
    setPhotos(ph || [])

    if (sess?.length) await loadSession(sess[0], cp, c.id, exMap)
    setLoading(false)
  }

  async function loadSession(sess: any, cp: any, clientId: string, exMap: Record<string, any[]>) {
    setActiveSession(sess); setLogs({}); setSaved(false)
    const exs = exMap[sess.id] || []
    setSessionExercises(exs)
    if (!exs.length) return
    const { data: progs } = await supabase.from('week_progressions').select('*')
      .in('exercise_id', exs.map((e: any) => e.id)).eq('week_num', cp.current_week)
    const pm: Record<string, any> = {}
    ;(progs || []).forEach((p: any) => { pm[p.exercise_id] = p })
    setSessionProgressions(pm)
    const { data: prev } = await supabase.from('weight_logs').select('*, exercises(name)')
      .eq('client_id', clientId).eq('week_num', cp.current_week - 1)
    setPrevLogs(prev || [])
  }

  function getExName(log: any) {
    const wps = log.exercises?.week_progressions || []
    return wps.find((wp: any) => wp.week_num === log.week_num)?.name || log.exercises?.name || '—'
  }

  function setLog(exId: string, field: 'kg' | 'reps', value: string) {
    const prog = sessionProgressions[exId]
    const sets = prog?.sets || sessionExercises.find(e => e.id === exId)?.sets || 1
    const newLogs = { ...logs }
    for (let s = 1; s <= sets; s++) {
      newLogs[`${exId}-${s}`] = { ...newLogs[`${exId}-${s}`], [field]: value }
    }
    setLogs(newLogs)
  }
  function getLog(exId: string) {
    return logs[`${exId}-1`] || { kg: '', reps: '' }
  }
  function getPrev(name: string) {
    const found = prevLogs.filter(l => l.exercises?.name === name)
    if (!found.length) return null
    return Math.max(...found.map(l => l.kg || 0)) || null
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
      const log = getLog(ex.id)
      if (log.kg) {
        for (let s = 1; s <= sets; s++) {
          toInsert.push({
            client_id: client.id, exercise_id: ex.id,
            week_num: activeProgram.current_week, set_num: s,
            kg: parseFloat(log.kg), reps_done: parseInt(log.reps) || null
          })
        }
      }
    }
    if (toInsert.length > 0) {
      await supabase.from('weight_logs').insert(toInsert)
      const { data: newLogs } = await supabase.from('weight_logs')
        .select('*, exercises(name, week_progressions(name, week_num))')
        .eq('client_id', client.id).order('logged_at', { ascending: false })
      setAllLogs(newLogs || [])
    }
    setSaving(false); setSaved(true)
  }

  async function saveMeasurement() {
    const data: any = { client_id: client.id, measured_at: newMeasurement.measured_at }
    const fields = ['weight', 'neck', 'shoulders', 'chest', 'waist', 'abdomen', 'hips',
      'arm_right', 'arm_left', 'forearm_right', 'forearm_left', 'thigh_right', 'thigh_left', 'calf_right', 'calf_left']
    fields.forEach(f => { if ((newMeasurement as any)[f]) data[f] = parseFloat((newMeasurement as any)[f]) })
    if (newMeasurement.notes) data.notes = newMeasurement.notes
    await supabase.from('measurements').insert(data)
    setAddingMeasurement(false)
    setNewMeasurement({
      measured_at: new Date().toISOString().slice(0, 10),
      weight: '', neck: '', shoulders: '', chest: '', waist: '', abdomen: '', hips: '',
      arm_right: '', arm_left: '', forearm_right: '', forearm_left: '',
      thigh_right: '', thigh_left: '', calf_right: '', calf_left: '', notes: ''
    })
    const { data: m } = await supabase.from('measurements').select('*').eq('client_id', client.id).order('measured_at', { ascending: false })
    setMeasurements(m || [])
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const fileName = `${client.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
    const { error } = await supabase.storage.from('progress-photos').upload(fileName, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('progress-photos').getPublicUrl(fileName)
      await supabase.from('progress_photos').insert({
        client_id: client.id, photo_url: urlData.publicUrl,
        photo_date: photoDate, caption: photoCaption || null
      })
      setPhotoCaption('')
      const { data: ph } = await supabase.from('progress_photos').select('*').eq('client_id', client.id).order('photo_date', { ascending: false })
      setPhotos(ph || [])
    }
    setUploadingPhoto(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Stats
  const totalSessions = new Set(allLogs.map(l => l.logged_at?.slice(0, 10))).size
  const totalVolume = allLogs.reduce((a, l) => a + (l.kg || 0), 0)
  const prMap: Record<string, number> = {}
  allLogs.forEach(l => {
    const name = getExName(l)
    if (name && name !== '—' && (!prMap[name] || l.kg > prMap[name])) prMap[name] = l.kg
  })
  const storicoPerEsercizio = allLogs.reduce((acc: any, l) => {
    const name = getExName(l)
    if (!acc[name]) acc[name] = []
    acc[name].push(l)
    return acc
  }, {})

  const filledCount = sessionExercises.filter(ex => getLog(ex.id).kg).length
  const totalCount = sessionExercises.length

  const inputStyle: any = {
    width: '100%', background: S.surface2, border: `1px solid ${S.border2}`,
    borderRadius: 10, padding: '11px 14px', color: S.text, fontSize: 14, outline: 'none'
  }

  const measureFields = [
    { key: 'weight', label: 'Peso', unit: 'kg' },
    { key: 'neck', label: 'Collo', unit: 'cm' },
    { key: 'shoulders', label: 'Spalle', unit: 'cm' },
    { key: 'chest', label: 'Petto', unit: 'cm' },
    { key: 'waist', label: 'Vita', unit: 'cm' },
    { key: 'abdomen', label: 'Addome', unit: 'cm' },
    { key: 'hips', label: 'Fianchi', unit: 'cm' },
    { key: 'arm_right', label: 'Braccio dx', unit: 'cm' },
    { key: 'arm_left', label: 'Braccio sx', unit: 'cm' },
    { key: 'forearm_right', label: 'Avambraccio dx', unit: 'cm' },
    { key: 'forearm_left', label: 'Avambraccio sx', unit: 'cm' },
    { key: 'thigh_right', label: 'Coscia dx', unit: 'cm' },
    { key: 'thigh_left', label: 'Coscia sx', unit: 'cm' },
    { key: 'calf_right', label: 'Polpaccio dx', unit: 'cm' },
    { key: 'calf_left', label: 'Polpaccio sx', unit: 'cm' },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 48, height: 48, background: S.accent, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
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
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: S.text, fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Ops!</div>
        <div style={{ color: S.text2, fontSize: 13, lineHeight: 1.6 }}>{error}</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text, maxWidth: 540, margin: '0 auto', paddingBottom: 80 }}>

      {/* HEADER STICKY */}
      <div style={{
        background: S.surface, borderBottom: `1px solid ${S.border}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 30
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, background: S.accent, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="6" width="14" height="4" rx="2" fill="#0C0D10"/>
              <rect x="4" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
              <rect x="9.5" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Fit<span style={{ color: S.accent }}>Coach</span></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {timer !== null && (
            <div onClick={() => timerRunning && startTimer(0)} style={{
              background: timerRunning ? 'rgba(180,255,79,0.12)' : S.surface2,
              border: `1px solid ${timerRunning ? 'rgba(180,255,79,0.4)' : S.border2}`,
              borderRadius: 10, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
            }}>
              {timerRunning && <div style={{ width: 6, height: 6, borderRadius: '50%', background: S.accent, animation: 'pulse 1s infinite' }} />}
              <span style={{ fontFamily: 'monospace', fontSize: 18, color: timerRunning ? S.accent : S.text2, fontWeight: 600 }}>{fmt(timer)}</span>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: S.text3, lineHeight: 1 }}>Settimana</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: S.accent, fontWeight: 600 }}>{activeProgram?.current_week}/{program?.total_weeks}</div>
          </div>
        </div>
      </div>

      {/* ===== HOME ===== */}
      {tab === 'home' && (
        <div style={{ padding: '20px 20px 0' }}>
          {/* Saluto */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 4 }}>
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              Ciao, {client?.name?.split(' ')[0]}! 👋
            </div>
          </div>

          {/* Card programma attivo */}
          <div style={{
            background: `linear-gradient(135deg, #13151A 0%, #1a2010 100%)`,
            border: '1px solid rgba(180,255,79,0.2)', borderRadius: 20, padding: 20, marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 600 }}>Programma attivo</div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{program?.name}</div>
                <div style={{ fontSize: 12, color: S.text3, marginTop: 4 }}>
                  {program?.goal} · {program?.level}
                </div>
              </div>
              <div style={{ background: 'rgba(180,255,79,0.15)', border: '1px solid rgba(180,255,79,0.3)', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: S.accent, lineHeight: 1 }}>{activeProgram?.current_week}</div>
                <div style={{ fontSize: 9, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>di {program?.total_weeks}</div>
              </div>
            </div>

            {/* Progresso settimane */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: S.text3, marginBottom: 6 }}>
                <span>Avanzamento mesociclo</span>
                <span>{Math.round((activeProgram?.current_week / program?.total_weeks) * 100)}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: S.accent, borderRadius: 3,
                  width: `${Math.min((activeProgram?.current_week / program?.total_weeks) * 100, 100)}%`,
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>

            {/* Pallini settimane */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {Array.from({ length: program?.total_weeks || 4 }, (_, i) => i + 1).map(w => (
                <div key={w} style={{
                  width: 28, height: 28, borderRadius: 7, fontSize: 10, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: w < activeProgram?.current_week ? 'rgba(180,255,79,0.25)' : w === activeProgram?.current_week ? S.accent : 'rgba(255,255,255,0.05)',
                  color: w === activeProgram?.current_week ? '#0C0D10' : w < activeProgram?.current_week ? S.accent : S.text3,
                  border: `1px solid ${w === activeProgram?.current_week ? S.accent : 'transparent'}`
                }}>
                  {w < activeProgram?.current_week ? '✓' : w}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Sessioni', value: totalSessions, icon: '🗓' },
              { label: 'PR personali', value: Object.keys(prMap).length, icon: '🏆', accent: true },
              { label: 'Kg totali', value: `${Math.round(totalVolume / 1000 * 10) / 10}t`, icon: '⚡' },
            ].map((s, i) => (
              <div key={i} style={{
                background: S.surface, border: `1px solid ${s.accent ? 'rgba(180,255,79,0.2)' : S.border}`,
                borderRadius: 14, padding: '14px 12px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 600, color: s.accent ? S.accent : S.text }}>{s.value}</div>
                <div style={{ fontSize: 10, color: S.text3, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Sessioni questa settimana */}
          <div style={{ fontSize: 11, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Sessioni disponibili
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {sessions.map((sess, i) => {
              const exCount = (allExercises[sess.id] || []).length
              return (
                <div key={sess.id}
                  onClick={() => { setTab('allena'); loadSession(sess, activeProgram, client.id, allExercises) }}
                  style={{
                    background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14,
                    padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    transition: 'border-color 0.15s, transform 0.1s'
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: 'rgba(180,255,79,0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: S.accent, flexShrink: 0
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{sess.name}</div>
                    <div style={{ fontSize: 12, color: S.text3 }}>{exCount} esercizi</div>
                  </div>
                  <div style={{ fontSize: 22, color: S.text3 }}>›</div>
                </div>
              )
            })}
          </div>

          <button onClick={() => setTab('allena')} style={{
            width: '100%', background: S.accent, color: '#0C0D10', border: 'none',
            borderRadius: 14, padding: '16px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            💪 Inizia allenamento
          </button>
        </div>
      )}

      {/* ===== ALLENA ===== */}
      {tab === 'allena' && (
        <div style={{ padding: '16px 20px 0' }}>

          {/* Selezione sessione */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {sessions.map(sess => (
              <button key={sess.id}
                onClick={() => loadSession(sess, activeProgram, client.id, allExercises)}
                style={{
                  flexShrink: 0, padding: '8px 16px', borderRadius: 20, fontSize: 13,
                  fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: activeSession?.id === sess.id ? S.accent : S.surface,
                  color: activeSession?.id === sess.id ? '#0C0D10' : S.text2,
                  outline: activeSession?.id === sess.id ? 'none' : `1px solid ${S.border}`
                }}>{sess.name}</button>
            ))}
          </div>

          {/* Progresso sessione */}
          {sessionExercises.length > 0 && (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: S.text3 }}>Progresso sessione</span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: filledCount === totalCount && totalCount > 0 ? S.accent : S.text2 }}>
                  {filledCount}/{totalCount} esercizi
                </span>
              </div>
              <div style={{ height: 4, background: S.surface3, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: S.accent, borderRadius: 2,
                  width: `${totalCount > 0 ? (filledCount / totalCount) * 100 : 0}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          {/* Esercizi — UN CAMPO PESO PER ESERCIZIO */}
          {sessionExercises.map((ex, idx) => {
            const prog = sessionProgressions[ex.id]
            const sets = prog?.sets || ex.sets
            const reps = prog?.reps || ex.reps
            const rir = prog?.rir ?? ex.rir
            const tut = prog?.tut || ''
            const rest = ex.rest_seconds
            const name = prog?.name || ex.name
            const log = getLog(ex.id)
            const prev = getPrev(name)
            const delta = log.kg && prev ? parseFloat(log.kg) - prev : null
            const isUp = delta !== null && delta > 0
            const isDown = delta !== null && delta < 0
            const hasKg = !!log.kg

            return (
              <div key={ex.id} style={{
                background: S.surface,
                border: `1px solid ${hasKg && isUp ? 'rgba(180,255,79,0.4)' : hasKg ? S.border2 : S.border}`,
                borderRadius: 16, marginBottom: 12, overflow: 'hidden', transition: 'border-color 0.2s'
              }}>
                {/* Header esercizio */}
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: hasKg ? 'rgba(180,255,79,0.15)' : 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: hasKg ? S.accent : S.text3
                    }}>{hasKg ? '✓' : idx + 1}</div>
                    <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{name}</span>
                  </div>

                  {/* Tags parametri */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { label: `${sets} serie`, color: S.text3 },
                      { label: `${reps} reps`, color: S.text3 },
                      rir !== undefined && rir !== null ? { label: `Buffer ${rir}`, color: S.text3 } : null,
                      tut ? { label: `TUT ${tut}`, color: S.blue } : null,
                      rest ? { label: `Rec. ${fmt(rest)}`, color: S.text3 } : null,
                    ].filter(Boolean).map((tag: any) => (
                      <span key={tag.label} style={{
                        background: S.surface2, border: `1px solid ${S.border}`,
                        borderRadius: 6, padding: '3px 9px', fontSize: 11, color: tag.color
                      }}>{tag.label}</span>
                    ))}
                    {rest && (
                      <button onClick={() => startTimer(rest)} style={{
                        background: timerRunning ? 'rgba(180,255,79,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${timerRunning ? 'rgba(180,255,79,0.4)' : S.border}`,
                        borderRadius: 6, padding: '3px 9px', fontSize: 11,
                        color: timerRunning ? S.accent : S.text3, cursor: 'pointer', fontWeight: 500
                      }}>⏱ Timer</button>
                    )}
                  </div>

                  {prog?.notes && (
                    <div style={{ marginTop: 8, fontSize: 12, color: S.amber, fontStyle: 'italic', lineHeight: 1.4 }}>
                      💡 {prog.notes}
                    </div>
                  )}
                </div>

                {/* Input peso principale */}
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                    {/* Settimana scorsa */}
                    <div style={{ textAlign: 'center', background: S.surface2, borderRadius: 12, padding: '12px 8px' }}>
                      <div style={{ fontSize: 9, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Sett. scorsa</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 600, color: S.text2, lineHeight: 1 }}>
                        {prev || '—'}
                      </div>
                      {prev && <div style={{ fontSize: 10, color: S.text3, marginTop: 4 }}>kg</div>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 18, color: S.text3 }}>→</div>
                      {delta !== null && (
                        <div style={{
                          fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                          color: isUp ? S.accent : isDown ? S.red : S.text3
                        }}>
                          {isUp ? `+${delta}` : isDown ? `${delta}` : '='} kg
                        </div>
                      )}
                    </div>

                    {/* Input oggi */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Oggi</div>
                      <input
                        type="number" step="0.5" min="0"
                        placeholder={prev ? String(prev) : 'kg'}
                        value={log.kg}
                        onChange={e => setLog(ex.id, 'kg', e.target.value)}
                        style={{
                          width: '100%', background: S.surface2,
                          border: `2px solid ${isUp ? 'rgba(180,255,79,0.7)' : isDown ? 'rgba(255,82,82,0.5)' : hasKg ? S.border2 : S.border}`,
                          borderRadius: 12, padding: '10px 8px', color: S.text,
                          fontFamily: 'monospace', fontSize: 28, textAlign: 'center',
                          outline: 'none', fontWeight: 700, transition: 'border-color 0.2s'
                        }}
                      />
                      <div style={{ fontSize: 10, color: S.text3, marginTop: 5 }}>kg × {sets} serie</div>
                    </div>
                  </div>

                  {/* Reps fatte */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: S.surface2, borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 13, color: S.text3, flex: 1 }}>Reps fatte per serie:</span>
                    <input
                      type="number" step="1" min="1" max="100"
                      placeholder={reps?.split?.('-')?.[0] || '—'}
                      value={log.reps}
                      onChange={e => setLog(ex.id, 'reps', e.target.value)}
                      style={{
                        width: 80, background: S.surface3, border: `1px solid ${S.border2}`,
                        borderRadius: 8, padding: '7px', color: S.text,
                        fontFamily: 'monospace', fontSize: 16, textAlign: 'center', outline: 'none', fontWeight: 600
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {sessionExercises.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: S.text3, fontSize: 14 }}>
              Seleziona una sessione qui sopra
            </div>
          )}

          {sessionExercises.length > 0 && (
            <button onClick={saveSession} disabled={saving || saved || filledCount === 0} style={{
              width: '100%', marginTop: 4, marginBottom: 12, padding: '16px',
              background: saved ? 'rgba(180,255,79,0.1)' : filledCount === 0 ? S.surface : S.accent,
              color: saved ? S.accent : filledCount === 0 ? S.text3 : '#0C0D10',
              border: saved ? `1px solid ${S.accent}` : `1px solid ${filledCount === 0 ? S.border : 'transparent'}`,
              borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: filledCount === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}>
              {saved ? '✓ Sessione salvata! Ottimo lavoro! 🎉'
                : saving ? 'Salvataggio...'
                  : filledCount === 0 ? 'Inserisci almeno un peso per salvare'
                    : `Salva sessione — ${filledCount}/${totalCount} esercizi`}
            </button>
          )}
        </div>
      )}

      {/* ===== PROGRAMMA ===== */}
      {tab === 'programma' && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{program?.name}</div>
            <div style={{ fontSize: 13, color: S.text2 }}>{program?.total_weeks} settimane · {program?.days_per_week} giorni/settimana · {program?.level}</div>
          </div>

          {/* Selector settimana */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
            {Array.from({ length: program?.total_weeks || 4 }, (_, i) => i + 1).map(w => {
              const isDeload = w === program?.total_weeks
              const isCurrent = w === activeProgram?.current_week
              const isSelected = w === programWeek
              return (
                <button key={w} onClick={() => setProgramWeek(w)} style={{
                  flexShrink: 0, padding: '7px 14px', borderRadius: 20, fontSize: 12.5,
                  fontWeight: isSelected ? 600 : 400, border: 'none', cursor: 'pointer',
                  background: isSelected ? S.accent : isCurrent ? 'rgba(180,255,79,0.1)' : S.surface,
                  color: isSelected ? '#0C0D10' : isCurrent ? S.accent : isDeload ? S.amber : S.text2,
                  outline: isSelected ? 'none' : `1px solid ${isCurrent ? 'rgba(180,255,79,0.3)' : S.border}`
                }}>
                  S{w}{isCurrent ? ' ●' : ''}{isDeload ? ' 🔄' : ''}
                </button>
              )
            })}
          </div>

          {programWeek === program?.total_weeks && (
            <div style={{ background: 'rgba(255,184,79,0.1)', border: '1px solid rgba(255,184,79,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: S.amber, marginBottom: 14 }}>
              🔄 Settimana di scarico — volume dimezzato, stessi carichi
            </div>
          )}

          {sessions.map(sess => {
            const exs = allExercises[sess.id] || []
            const progs = allProgressions[sess.id] || []
            return (
              <div key={sess.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{sess.name}</span>
                  <span style={{ fontSize: 11, color: S.text3, background: S.surface2, borderRadius: 6, padding: '3px 8px' }}>{exs.length} esercizi</span>
                </div>
                {exs.map((ex: any, idx: number) => {
                  const wp = progs.find((p: any) => p.exercise_id === ex.id && p.week_num === programWeek)
                  const name = wp?.name || ex.name
                  const sets = wp?.sets || ex.sets
                  const reps = wp?.reps || ex.reps
                  const rir = wp?.rir ?? ex.rir
                  const tut = wp?.tut || ''
                  const rest = ex.rest_seconds
                  return (
                    <div key={ex.id} style={{
                      padding: '13px 16px', borderTop: idx > 0 ? `1px solid ${S.border}` : 'none',
                      display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: 10, alignItems: 'start'
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: S.text3, paddingTop: 4 }}>{idx + 1}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{name}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {[
                            tut ? `TUT ${tut}` : null,
                            rest ? `Rec. ${fmt(rest)}` : null,
                          ].filter(Boolean).map(tag => (
                            <span key={tag as string} style={{ fontSize: 10, color: S.text3, background: S.surface2, borderRadius: 4, padding: '2px 6px' }}>{tag}</span>
                          ))}
                        </div>
                        {wp?.notes && <div style={{ fontSize: 11, color: S.amber, marginTop: 5, fontStyle: 'italic', lineHeight: 1.4 }}>💡 {wp.notes}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 14, color: S.accent, fontWeight: 700 }}>{sets}×{reps}</div>
                        <div style={{ fontSize: 10, color: S.text3, marginTop: 2 }}>Buffer {rir}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          <button onClick={() => window.open(`/cliente/${token}/pdf`, '_blank')} style={{
            width: '100%', marginBottom: 12, background: S.surface, border: `1px solid ${S.border2}`,
            borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 500,
            color: S.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>📄 Scarica PDF scheda</button>
        </div>
      )}

      {/* ===== PROGRESSI ===== */}
      {tab === 'progressi' && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>I tuoi progressi</div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Sessioni', value: totalSessions, icon: '🗓', accent: false },
              { label: 'Kg totali', value: `${Math.round(totalVolume).toLocaleString()}`, icon: '⚡', accent: false },
              { label: 'Record personali', value: Object.keys(prMap).length, icon: '🏆', accent: true },
              { label: 'Serie totali', value: allLogs.length, icon: '📊', accent: false },
            ].map((s, i) => (
              <div key={i} style={{
                background: S.surface, border: `1px solid ${s.accent ? 'rgba(180,255,79,0.2)' : S.border}`,
                borderRadius: 14, padding: '16px'
              }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 600, color: s.accent ? S.accent : S.text, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Record personali */}
          {Object.keys(prMap).length > 0 && (
            <>
              <div style={{ fontSize: 11, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>🏆 Record personali</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {Object.entries(prMap).sort(([, a], [, b]) => (b as number) - (a as number)).map(([name, kg]) => (
                  <div key={name} style={{
                    background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12,
                    padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 500, flex: 1, marginRight: 10 }}>{name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: S.accent, flexShrink: 0 }}>{kg as number} kg</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Storico per esercizio con grafico a barre */}
          {Object.keys(storicoPerEsercizio).length > 0 && (
            <>
              <div style={{ fontSize: 11, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>📈 Progressione pesi</div>
              {Object.entries(storicoPerEsercizio).map(([name, exLogs]: [string, any]) => {
                const maxKg = Math.max(...exLogs.map((l: any) => l.kg || 0))
                const sorted = [...exLogs].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
                const recent = sorted.filter((l, i, arr) => i === 0 || l.set_num === 1).slice(-8)
                return (
                  <div key={name} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, color: S.accent, fontWeight: 600 }}>PR {maxKg} kg</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 64 }}>
                      {recent.map((log: any, i: number) => {
                        const h = maxKg > 0 ? Math.max(Math.round((log.kg / maxKg) * 48), 4) : 4
                        const isPR = log.kg === maxKg
                        return (
                          <div key={log.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ fontSize: 9, color: isPR ? S.accent : S.text3, fontFamily: 'monospace', fontWeight: isPR ? 700 : 400 }}>{log.kg}</div>
                            <div style={{ width: '100%', height: h, background: isPR ? S.accent : S.surface3, borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', minHeight: 4 }} />
                            <div style={{ fontSize: 8, color: S.text3 }}>S{log.week_num}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {allLogs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <div style={{ color: S.text2, fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Nessun dato ancora</div>
              <div style={{ color: S.text3, fontSize: 13, marginBottom: 20 }}>Inizia ad allenarti per vedere i tuoi progressi!</div>
              <button onClick={() => setTab('allena')} style={{
                background: S.accent, color: '#0C0D10', border: 'none',
                borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
              }}>Inizia ora →</button>
            </div>
          )}
        </div>
      )}

      {/* ===== PROFILO ===== */}
      {tab === 'profilo' && (
        <div style={{ padding: '16px 20px 0' }}>
          {/* Header profilo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(180,255,79,0.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: S.accent,
              border: '2px solid rgba(180,255,79,0.3)'
            }}>
              {client?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{client?.name}</div>
              <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>
                {client?.goal || '—'} · {client?.level || '—'}
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', background: S.surface2, borderRadius: 12, padding: 4, marginBottom: 20 }}>
            {[
              { id: 'peso', label: '⚖️ Peso' },
              { id: 'misurazioni', label: '📏 Misure' },
              { id: 'foto', label: '📸 Foto' },
            ].map(t => (
              <button key={t.id} onClick={() => setProfiloTab(t.id as any)} style={{
                flex: 1, padding: '9px 4px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: profiloTab === t.id ? S.surface : 'transparent',
                color: profiloTab === t.id ? S.text : S.text3,
                fontSize: 12, fontWeight: profiloTab === t.id ? 600 : 400, transition: 'all 0.15s'
              }}>{t.label}</button>
            ))}
          </div>

          {/* --- PESO --- */}
          {profiloTab === ('peso' as any) && (
            <div>
              {/* Peso attuale e trend */}
              {measurements.length > 0 && measurements.some(m => m.weight) && (() => {
                const withWeight = measurements.filter(m => m.weight)
                const last = withWeight[0]
                const first = withWeight[withWeight.length - 1]
                const delta = withWeight.length >= 2 ? (last.weight - first.weight).toFixed(1) : null
                return (
                  <div style={{ background: 'linear-gradient(135deg, #13151A, #1a2010)', border: '1px solid rgba(180,255,79,0.2)', borderRadius: 18, padding: 20, marginBottom: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>Peso attuale</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 52, fontWeight: 700, color: S.text, lineHeight: 1 }}>{last.weight}</div>
                    <div style={{ fontSize: 16, color: S.text3, marginBottom: 12 }}>kg</div>
                    {delta && (
                      <div style={{
                        display: 'inline-block', background: parseFloat(delta) < 0 ? 'rgba(180,255,79,0.15)' : 'rgba(255,184,79,0.15)',
                        border: `1px solid ${parseFloat(delta) < 0 ? 'rgba(180,255,79,0.3)' : 'rgba(255,184,79,0.3)'}`,
                        borderRadius: 20, padding: '5px 16px', fontFamily: 'monospace', fontSize: 15, fontWeight: 700,
                        color: parseFloat(delta) < 0 ? S.accent : S.amber
                      }}>
                        {parseFloat(delta) > 0 ? '+' : ''}{delta} kg dall&apos;inizio
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: S.text3, marginTop: 10 }}>
                      Ultima rilevazione: {new Date(last.measured_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                )
              })()}

              {/* Grafico pesi */}
              {measurements.filter(m => m.weight).length >= 2 && (() => {
                const withWeight = [...measurements.filter(m => m.weight)].reverse()
                const maxW = Math.max(...withWeight.map(m => m.weight))
                const minW = Math.min(...withWeight.map(m => m.weight))
                const range = maxW - minW || 1
                return (
                  <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: '16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: S.text3, marginBottom: 12 }}>Andamento peso</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, marginBottom: 8 }}>
                      {withWeight.map((m, i) => {
                        const h = Math.max(Math.round(((m.weight - minW) / range) * 60) + 16, 16)
                        const isLast = i === withWeight.length - 1
                        return (
                          <div key={m.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ fontSize: 9, color: isLast ? S.accent : S.text3, fontFamily: 'monospace' }}>{m.weight}</div>
                            <div style={{ width: '100%', height: h, background: isLast ? S.accent : S.surface3, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                            <div style={{ fontSize: 8, color: S.text3 }}>
                              {new Date(m.measured_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Form inserimento peso rapido */}
              {addingMeasurement && (newMeasurement as any)._quick ? (
                <div style={{ background: S.surface, border: '1px solid rgba(180,255,79,0.3)', borderRadius: 16, padding: 18, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Inserisci peso di oggi</div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: S.text3, marginBottom: 6 }}>Data</div>
                    <input type="date" value={newMeasurement.measured_at}
                      onChange={e => setNewMeasurement({ ...newMeasurement, measured_at: e.target.value })}
                      style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: S.text3, marginBottom: 6 }}>Peso (kg)</div>
                    <input type="number" step="0.1" min="30" max="300" placeholder="es. 75.5"
                      value={newMeasurement.weight}
                      onChange={e => setNewMeasurement({ ...newMeasurement, weight: e.target.value })}
                      style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 28, textAlign: 'center', fontWeight: 700, padding: '14px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setAddingMeasurement(false); setNewMeasurement({ ...newMeasurement, _quick: false } as any) }}
                      style={{ flex: 1, background: 'none', border: `1px solid ${S.border2}`, borderRadius: 10, padding: '11px', fontSize: 14, color: S.text2, cursor: 'pointer' }}>Annulla</button>
                    <button onClick={saveMeasurement}
                      style={{ flex: 2, background: S.accent, color: '#0C0D10', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Salva</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAddingMeasurement(true); setNewMeasurement({ ...newMeasurement, _quick: true } as any) }} style={{
                  width: '100%', background: S.accent, color: '#0C0D10', border: 'none',
                  borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 16
                }}>+ Inserisci peso di oggi</button>
              )}

              {/* Storico pesi */}
              {measurements.filter(m => m.weight).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Storico pesi</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {measurements.filter(m => m.weight).map(m => (
                      <div key={m.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: S.text }}>
                            {new Date(m.measured_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </div>
                          {m.notes && <div style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>{m.notes}</div>}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: S.text }}>{m.weight} <span style={{ fontSize: 13, color: S.text3 }}>kg</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {measurements.filter(m => m.weight).length === 0 && !addingMeasurement && (
                <div style={{ textAlign: 'center', padding: '30px 0', color: S.text3, fontSize: 13 }}>
                  Nessun peso registrato ancora
                </div>
              )}
            </div>
          )}

          {/* --- MISURAZIONI --- */}
          {profiloTab === 'misurazioni' && (
            <div>
              {/* Variazioni peso se ci sono dati */}
              {measurements.length >= 2 && (() => {
                const first = measurements[measurements.length - 1]
                const last = measurements[0]
                const deltaWeight = first.weight && last.weight ? (last.weight - first.weight).toFixed(1) : null
                return (
                  <div style={{ background: 'linear-gradient(135deg, #13151A, #1a2010)', border: '1px solid rgba(180,255,79,0.15)', borderRadius: 16, padding: 18, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontWeight: 600 }}>
                      Variazioni ({new Date(first.measured_at).toLocaleDateString('it-IT')} → {new Date(last.measured_at).toLocaleDateString('it-IT')})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {[
                        { label: 'Peso', first: first.weight, last: last.weight, unit: 'kg' },
                        { label: 'Vita', first: first.waist, last: last.waist, unit: 'cm' },
                        { label: 'Petto', first: first.chest, last: last.chest, unit: 'cm' },
                      ].map(m => {
                        if (!m.first && !m.last) return null
                        const d = m.first && m.last ? (m.last - m.first).toFixed(1) : null
                        return (
                          <div key={m.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 9, color: S.text3, marginBottom: 4, textTransform: 'uppercase' }}>{m.label}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: S.text }}>{m.last || m.first} {m.unit}</div>
                            {d && <div style={{ fontSize: 11, color: parseFloat(d) > 0 ? S.amber : S.accent, fontWeight: 600 }}>{parseFloat(d) > 0 ? '+' : ''}{d}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Form nuova misurazione */}
              {addingMeasurement ? (
                <div style={{ background: S.surface, border: '1px solid rgba(180,255,79,0.3)', borderRadius: 16, padding: 18, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Nuova rilevazione</div>
                  <div style={{ fontSize: 12, color: S.text3, marginBottom: 16 }}>Inserisci solo i valori che hai misurato</div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: S.text3, marginBottom: 6 }}>Data</div>
                    <input type="date" value={newMeasurement.measured_at}
                      onChange={e => setNewMeasurement({ ...newMeasurement, measured_at: e.target.value })}
                      style={inputStyle} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {measureFields.map(f => (
                      <div key={f.key}>
                        <div style={{ fontSize: 11, color: S.text3, marginBottom: 5 }}>{f.label} ({f.unit})</div>
                        <input type="number" step="0.1" min="0" placeholder="—"
                          value={(newMeasurement as any)[f.key]}
                          onChange={e => setNewMeasurement({ ...newMeasurement, [f.key]: e.target.value })}
                          style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontSize: 16 }} />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: S.text3, marginBottom: 6 }}>Note</div>
                    <input placeholder="es. a digiuno, dopo allenamento..." value={newMeasurement.notes}
                      onChange={e => setNewMeasurement({ ...newMeasurement, notes: e.target.value })}
                      style={inputStyle} />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setAddingMeasurement(false)} style={{ flex: 1, background: 'none', border: `1px solid ${S.border2}`, borderRadius: 10, padding: '11px', fontSize: 14, color: S.text2, cursor: 'pointer' }}>Annulla</button>
                    <button onClick={saveMeasurement} style={{ flex: 2, background: S.accent, color: '#0C0D10', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Salva</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingMeasurement(true)} style={{
                  width: '100%', background: S.accent, color: '#0C0D10', border: 'none',
                  borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 16
                }}>+ Aggiungi misurazione</button>
              )}

              {/* Storico misurazioni */}
              {measurements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: S.text3, fontSize: 13 }}>
                  Nessuna misurazione ancora — aggiungine una!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {measurements.map(m => (
                    <div key={m.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 10 }}>
                        {new Date(m.measured_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {measureFields.filter(f => m[f.key]).map(f => (
                          <div key={f.key} style={{ background: S.surface2, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                            <div style={{ fontSize: 9, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{f.label}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 600, color: S.text }}>{m[f.key]} <span style={{ fontSize: 10, color: S.text3 }}>{f.unit}</span></div>
                          </div>
                        ))}
                      </div>
                      {m.notes && <div style={{ fontSize: 11, color: S.text3, marginTop: 8, fontStyle: 'italic' }}>📝 {m.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- FOTO PROGRESS --- */}
          {profiloTab === 'foto' && (
            <div>
              {/* Upload */}
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Carica nuova foto</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: S.text3, marginBottom: 6 }}>Data foto</div>
                  <input type="date" value={photoDate} onChange={e => setPhotoDate(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: S.text3, marginBottom: 6 }}>Descrizione (es. Fronte, Profilo, Schiena)</div>
                  <input placeholder="es. Fronte" value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} style={inputStyle} />
                </div>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} style={{
                  width: '100%', background: S.accent, color: '#0C0D10', border: 'none',
                  borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                }}>
                  {uploadingPhoto ? '⏳ Caricamento...' : '📸 Scegli foto dal telefono'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={uploadPhoto} style={{ display: 'none' }} />
              </div>

              {/* Confronto affiancato */}
              {photos.length >= 2 && (
                <div style={{ background: S.surface, border: '1px solid rgba(180,255,79,0.2)', borderRadius: 16, padding: 18, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Confronto</div>
                  <div style={{ fontSize: 12, color: S.text3, marginBottom: 14 }}>Seleziona due foto per vederle affiancate</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Prima', value: compareA, set: setCompareA },
                      { label: 'Dopo', value: compareB, set: setCompareB },
                    ].map(sel => (
                      <div key={sel.label}>
                        <div style={{ fontSize: 10, color: S.text3, marginBottom: 6, textTransform: 'uppercase' }}>{sel.label}</div>
                        <select value={sel.value} onChange={e => sel.set(e.target.value)} style={{ ...inputStyle, fontSize: 12, cursor: 'pointer', padding: '9px 10px' }}>
                          <option value="">Scegli...</option>
                          {photos.map(p => <option key={p.id} value={p.id}>{new Date(p.photo_date).toLocaleDateString('it-IT')}{p.caption ? ` · ${p.caption}` : ''}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  {compareA && compareB && compareA !== compareB && (() => {
                    const pA = photos.find(p => p.id === compareA)
                    const pB = photos.find(p => p.id === compareB)
                    return pA && pB ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[pA, pB].map((p, i) => (
                          <div key={p.id}>
                            <img src={p.photo_url} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 10, border: `1px solid ${S.border}`, display: 'block' }} />
                            <div style={{ fontSize: 11, color: S.text3, textAlign: 'center', marginTop: 6 }}>
                              {i === 0 ? 'Prima' : 'Dopo'} · {new Date(p.photo_date).toLocaleDateString('it-IT')}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null
                  })()}
                </div>
              )}

              {/* Galleria */}
              {photos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
                  <div style={{ color: S.text2, fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Nessuna foto ancora</div>
                  <div style={{ color: S.text3, fontSize: 12 }}>Carica la prima per iniziare a tracciare i cambiamenti</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Galleria — {photos.length} foto</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {photos.map(photo => (
                      <div key={photo.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, overflow: 'hidden' }}>
                        <img src={photo.photo_url} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: S.text }}>
                            {new Date(photo.photo_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </div>
                          {photo.caption && <div style={{ fontSize: 10, color: S.text3, marginTop: 2 }}>{photo.caption}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* BOTTOM NAV */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 540,
        background: S.surface, borderTop: `1px solid ${S.border}`,
        display: 'flex', zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}>
        {([
          ['home', '🏠', 'Home'],
          ['allena', '💪', 'Allena'],
          ['programma', '📋', 'Programma'],
          ['progressi', '📊', 'Progressi'],
          ['profilo', '👤', 'Profilo'],
        ] as const).map(([t, icon, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0 8px', border: 'none', background: 'none',
            color: tab === t ? S.accent : S.text3, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            position: 'relative', transition: 'color 0.15s'
          }}>
            {tab === t && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 28, height: 2, background: S.accent, borderRadius: '0 0 2px 2px'
              }} />
            )}
            <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
            <span style={{ fontSize: 9.5, fontWeight: tab === t ? 600 : 400, letterSpacing: '0.02em' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
