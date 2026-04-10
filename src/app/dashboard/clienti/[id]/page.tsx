'use client'
import { useEffect, useState, useRef, FormEvent } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function ClienteDetail() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  const [newMeasurement, setNewMeasurement] = useState({
    measured_at: new Date().toISOString().slice(0, 10),
    weight: '', neck: '', shoulders: '', chest: '',
    waist: '', abdomen: '', hips: '',
    arm_right: '', arm_left: '', forearm_right: '', forearm_left: '',
    thigh_right: '', thigh_left: '', calf_right: '', calf_left: '',
    notes: ''
  })
  const [photos, setPhotos] = useState<any[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().slice(0, 10))
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const [revealPassword, setRevealPassword] = useState(false)

  useEffect(() => {
    load()

    const channel = supabase
      .channel(`client-${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'client_programs',
        filter: `client_id=eq.${id}`
      }, () => load())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'weight_logs',
        filter: `client_id=eq.${id}`
      }, () => load())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'measurements',
        filter: `client_id=eq.${id}`
      }, () => load())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'progress_photos',
        filter: `client_id=eq.${id}`
      }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function load() {
    const { data: c } = await supabase.from('clients').select('*').eq('id', id).single()
    setClient(c)
    setEditForm(c || {})

    const { data: l } = await supabase.from('weight_logs')
      .select('*, exercises(id, name, week_progressions(name, week_num))')
      .eq('client_id', id)
      .order('logged_at', { ascending: false })
      .limit(200)
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

    const { data: ph } = await supabase.from('progress_photos')
      .select('*').eq('client_id', id).order('photo_date', { ascending: false })
    setPhotos(ph || [])
  }

  function getExerciseName(log: any) {
    const wps = log.exercises?.week_progressions || []
    const match = wps.find((wp: any) => wp.week_num === log.week_num)
    return match?.name || log.exercises?.name || '—'
  }

  async function saveClient(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('clients').update({
      name: editForm.name, email: editForm.email,
      goal: editForm.goal, level: editForm.level,
      phone: editForm.phone, birthdate: editForm.birthdate,
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
      .insert({ ...newProgram, trainer_id: user?.id }).select().single()
    if (prog) {
      await supabase.from('client_programs').update({ is_active: false }).eq('client_id', id)
      await supabase.from('client_programs').insert({
        client_id: id, program_id: prog.id, current_week: 1, is_active: true,
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
    const data: any = { client_id: id, measured_at: newMeasurement.measured_at }
    const fields = ['weight', 'neck', 'shoulders', 'chest', 'waist', 'abdomen', 'hips',
      'arm_right', 'arm_left', 'forearm_right', 'forearm_left',
      'thigh_right', 'thigh_left', 'calf_right', 'calf_left']
    fields.forEach(f => { if ((newMeasurement as any)[f]) data[f] = parseFloat((newMeasurement as any)[f]) })
    if (newMeasurement.notes) data.notes = newMeasurement.notes
    await supabase.from('measurements').insert(data)
    setAddingMeasurement(false)
    setNewMeasurement({
      measured_at: new Date().toISOString().slice(0, 10),
      weight: '', neck: '', shoulders: '', chest: '',
      waist: '', abdomen: '', hips: '',
      arm_right: '', arm_left: '', forearm_right: '', forearm_left: '',
      thigh_right: '', thigh_left: '', calf_right: '', calf_left: '',
      notes: ''
    })
    load()
  }

  async function deleteMeasurement(mId: string) {
    if (!confirm('Eliminare questa misurazione?')) return
    await supabase.from('measurements').delete().eq('id', mId)
    load()
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const fileName = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
    const { error } = await supabase.storage.from('progress-photos').upload(fileName, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('progress-photos').getPublicUrl(fileName)
      await supabase.from('progress_photos').insert({
        client_id: id, photo_url: urlData.publicUrl,
        photo_date: photoDate, caption: photoCaption || null
      })
      setPhotoCaption('')
      load()
    }
    setUploadingPhoto(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function deletePhoto(photoId: string, photoUrl: string) {
    if (!confirm('Eliminare questa foto?')) return
    const path = photoUrl.split('/progress-photos/')[1]
    if (path) await supabase.storage.from('progress-photos').remove([path])
    await supabase.from('progress_photos').delete().eq('id', photoId)
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

  if (!client) return <div style={{ padding: 28, color: 'var(--text3)' }}>Caricamento...</div>

  const initials = client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const activeProgram = assignedPrograms.find(ap => ap.is_active)
  const totalSessions = new Set(logs.map(l => l.logged_at?.slice(0, 10))).size
  const totalVolume = logs.reduce((a, l) => a + (l.kg || 0), 0)
  const prMap: Record<string, number> = {}
  logs.forEach(l => {
    const name = getExerciseName(l)
    if (name && name !== '—' && (!prMap[name] || l.kg > prMap[name])) prMap[name] = l.kg
  })

  const inputStyle: any = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14, outline: 'none'
  }

  // Raggruppa sessioni per data
  const sessionsByDate = logs.reduce((acc: any, l) => {
    const date = l.logged_at?.slice(0, 10)
    if (!acc[date]) acc[date] = []
    acc[date].push(l)
    return acc
  }, {})

  const TABS = [
    { id: 'overview', label: 'Panoramica' },
    { id: 'schede', label: 'Programma' },
    { id: 'storico', label: 'Allenamenti' },
    { id: 'misurazioni', label: 'Misurazioni' },
    { id: 'foto', label: 'Foto Progress' },
    { id: 'note', label: 'Note' },
    { id: 'account', label: 'Account' },
  ]

  // Campi misurazione con label italiane chiare
  const measureFields = [
    { key: 'weight', label: 'Peso corporeo', unit: 'kg', group: 'peso' },
    { key: 'neck', label: 'Collo', unit: 'cm', group: 'upper' },
    { key: 'shoulders', label: 'Spalle', unit: 'cm', group: 'upper' },
    { key: 'chest', label: 'Petto', unit: 'cm', group: 'upper' },
    { key: 'waist', label: 'Vita', unit: 'cm', group: 'core' },
    { key: 'abdomen', label: 'Addome (ombelico)', unit: 'cm', group: 'core' },
    { key: 'hips', label: 'Fianchi', unit: 'cm', group: 'core' },
    { key: 'arm_right', label: 'Braccio destro', unit: 'cm', group: 'arms' },
    { key: 'arm_left', label: 'Braccio sinistro', unit: 'cm', group: 'arms' },
    { key: 'forearm_right', label: 'Avambraccio destro', unit: 'cm', group: 'arms' },
    { key: 'forearm_left', label: 'Avambraccio sinistro', unit: 'cm', group: 'arms' },
    { key: 'thigh_right', label: 'Coscia destra', unit: 'cm', group: 'legs' },
    { key: 'thigh_left', label: 'Coscia sinistra', unit: 'cm', group: 'legs' },
    { key: 'calf_right', label: 'Polpaccio destro', unit: 'cm', group: 'legs' },
    { key: 'calf_left', label: 'Polpaccio sinistro', unit: 'cm', group: 'legs' },
  ]

  const measureGroups = [
    { id: 'peso', label: 'Peso' },
    { id: 'upper', label: 'Parte superiore' },
    { id: 'core', label: 'Tronco' },
    { id: 'arms', label: 'Braccia' },
    { id: 'legs', label: 'Gambe' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* HEADER */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '18px 28px' }}>
        <button onClick={() => router.push('/dashboard/clienti')} style={{
          background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13,
          cursor: 'pointer', marginBottom: 14, padding: 0
        }}>← Tutti i clienti</button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(180,255,79,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: 'var(--accent)',
            border: '2px solid rgba(180,255,79,0.3)'
          }}>{initials}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-syne)', fontSize: 20, fontWeight: 700 }}>{client.name}</div>
              {activeProgram ? (
                <span style={{ background: 'rgba(180,255,79,0.12)', color: 'var(--accent)', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 500 }}>
                  ● {activeProgram.programs?.name} · Sett. {activeProgram.current_week}/{activeProgram.programs?.total_weeks}
                </span>
              ) : (
                <span style={{ background: 'rgba(255,184,79,0.12)', color: 'var(--amber)', borderRadius: 20, padding: '3px 12px', fontSize: 11 }}>⚠ Nessuna scheda assegnata</span>
              )}
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {client.email && <span>📧 {client.email}</span>}
              {client.phone && <span>📱 {client.phone}</span>}
              {client.goal && <span>🎯 Obiettivo: {client.goal}</span>}
              {client.level && <span>⭐ {client.level}</span>}
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Sessioni totali', value: totalSessions },
                { label: 'Serie registrate', value: logs.length },
                { label: 'Record personali', value: Object.keys(prMap).length },
                { label: 'Volume totale', value: `${Math.round(totalVolume / 1000 * 10) / 10}t` },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 17, fontWeight: 500, color: i === 2 ? 'var(--accent)' : 'var(--text)' }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={copyCredentials} style={{
              background: linkCopied ? 'rgba(180,255,79,0.15)' : 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 8, padding: '7px 12px', fontSize: 12, color: linkCopied ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontWeight: 500
            }}>📱 {linkCopied ? 'Copiato!' : 'Cred. WhatsApp'}</button>
            <button onClick={copyLink} style={{
              background: 'rgba(180,255,79,0.08)', border: '1px solid rgba(180,255,79,0.2)',
              borderRadius: 8, padding: '7px 12px', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500
            }}>🔗 Link diretto</button>
            <button onClick={() => { setEditing(true); setTab('account') }} style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 8, padding: '7px 12px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer'
            }}>✏️ Modifica</button>
            <button onClick={() => setTab('schede')} style={{
              background: 'var(--accent)', color: '#0C0D10', border: 'none',
              borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>+ Scheda</button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', overflowX: 'auto', paddingLeft: 28
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '11px 18px', fontSize: 13, border: 'none', background: 'none',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.id ? 'var(--accent)' : 'var(--text3)',
            cursor: 'pointer', fontWeight: tab === t.id ? 500 : 400, whiteSpace: 'nowrap'
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* ===== PANORAMICA ===== */}
        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Sessioni di allenamento completate', value: totalSessions, color: 'var(--text)' },
                { label: 'Serie di esercizi registrate', value: logs.length, color: 'var(--text)' },
                { label: 'Record personali raggiunti', value: Object.keys(prMap).length, color: 'var(--accent)' },
                { label: 'Kg totali sollevati nel periodo', value: `${Math.round(totalVolume).toLocaleString()} kg`, color: 'var(--accent)' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.4 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 24, fontWeight: 500, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Ultime sessioni */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14 }}>Ultime sessioni</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Le sessioni di allenamento completate dal cliente</div>
                  </div>
                  <button onClick={() => setTab('storico')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>Vedi tutte →</button>
                </div>
                {Object.keys(sessionsByDate).length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nessuna sessione ancora</div>
                ) : (
                  Object.entries(sessionsByDate).slice(0, 5).map(([date, dayLogs]: [string, any]) => {
                    const dayVolume = dayLogs.reduce((a: number, l: any) => a + (l.kg || 0), 0)
                    const exercises = [...new Set(dayLogs.map((l: any) => getExerciseName(l)))]
                    return (
                      <div key={date} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 8, background: 'rgba(180,255,79,0.1)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                            {new Date(date).getDate()}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase' }}>
                            {new Date(date).toLocaleDateString('it-IT', { month: 'short' })}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 3 }}>
                            {new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {dayLogs.length} serie · {Math.round(dayVolume)} kg volume · {exercises.slice(0, 3).join(', ')}{exercises.length > 3 ? '...' : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Record personali */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14 }}>🏆 Record personali</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Il peso massimo sollevato per ogni esercizio</div>
                </div>
                {Object.keys(prMap).length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nessun record ancora</div>
                ) : (
                  Object.entries(prMap).sort(([, a], [, b]) => (b as number) - (a as number)).map(([name, kg]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10 }}>{name}</span>
                      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 14, color: 'var(--accent)', fontWeight: 500, flexShrink: 0 }}>{kg as number} kg</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== PROGRAMMA ===== */}
        {tab === 'schede' && (
          <div>
            {assignedPrograms.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Programmi assegnati a {client.name.split(' ')[0]}
                </div>
                {assignedPrograms.map(ap => (
                  <div key={ap.id} style={{
                    background: 'var(--surface)', border: `1px solid ${ap.is_active ? 'rgba(180,255,79,0.3)' : 'var(--border)'}`,
                    borderRadius: 14, padding: '18px 20px', marginBottom: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {ap.is_active && <span style={{ background: 'rgba(180,255,79,0.12)', color: 'var(--accent)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 500 }}>● Attivo ora</span>}
                        <span style={{ fontFamily: 'var(--font-syne)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{ap.programs?.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => router.push(`/dashboard/schede/${ap.program_id}`)} style={{
                          background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer'
                        }}>✏️ Modifica esercizi</button>
                        <button onClick={() => toggleActive(ap.id, ap.is_active)} style={{
                          background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, padding: '5px 10px', fontSize: 11,
                          color: ap.is_active ? 'var(--red)' : 'var(--accent)', cursor: 'pointer'
                        }}>{ap.is_active ? 'Disattiva' : 'Attiva'}</button>
                        <button onClick={() => removeProgram(ap.id)} style={{
                          background: 'none', border: '1px solid var(--border2)', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: 'var(--text3)', cursor: 'pointer'
                        }}>✕</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                      Obiettivo: {ap.programs?.goal || '—'} · Livello: {ap.programs?.level || '—'} · {ap.programs?.days_per_week} giorni/settimana · {ap.programs?.total_weeks} settimane totali
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                          <span>Avanzamento settimane</span>
                          <span>Settimana {ap.current_week} di {ap.programs?.total_weeks}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 3, width: `${Math.min((ap.current_week / ap.programs?.total_weeks) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Sett.:</span>
                        <button onClick={() => updateWeek(ap.id, Math.max(1, ap.current_week - 1))} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 10px', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>←</button>
                        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: 'var(--text)', minWidth: 20, textAlign: 'center' }}>{ap.current_week}</span>
                        <button onClick={() => updateWeek(ap.id, Math.min(ap.programs?.total_weeks, ap.current_week + 1))} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 10px', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>→</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>Iniziata il {new Date(ap.started_at).toLocaleDateString('it-IT')}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>✨ Crea scheda su misura</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Crea un programma nuovo personalizzato per {client.name.split(' ')[0]}</div>
                {!creatingProgram ? (
                  <button onClick={() => setCreatingProgram(true)} style={{ width: '100%', background: 'var(--accent)', color: '#0C0D10', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Crea nuova scheda</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input placeholder="Nome del programma *" value={newProgram.name} onChange={e => setNewProgram({ ...newProgram, name: e.target.value })} style={{ ...inputStyle, fontSize: 13 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <select value={newProgram.goal} onChange={e => setNewProgram({ ...newProgram, goal: e.target.value })} style={{ ...inputStyle, fontSize: 13, cursor: 'pointer' }}>
                        <option value="">Obiettivo...</option>
                        <option>Ipertrofia</option><option>Forza</option><option>Dimagrimento</option><option>Tonificazione</option><option>Resistenza</option>
                      </select>
                      <select value={newProgram.level} onChange={e => setNewProgram({ ...newProgram, level: e.target.value })} style={{ ...inputStyle, fontSize: 13, cursor: 'pointer' }}>
                        <option>Principiante</option><option>Intermedio</option><option>Avanzato</option>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>N° settimane</div>
                        <input type="number" min="1" max="52" value={newProgram.total_weeks} onChange={e => setNewProgram({ ...newProgram, total_weeks: parseInt(e.target.value) })} style={{ ...inputStyle, fontSize: 13 }} /></div>
                      <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Giorni/settimana</div>
                        <input type="number" min="1" max="7" value={newProgram.days_per_week} onChange={e => setNewProgram({ ...newProgram, days_per_week: parseInt(e.target.value) })} style={{ ...inputStyle, fontSize: 13 }} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setCreatingProgram(false)} style={{ flex: 1, background: 'none', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>Annulla</button>
                      <button onClick={createAndAssignProgram} disabled={!newProgram.name || saving} style={{ flex: 2, background: 'var(--accent)', color: '#0C0D10', border: 'none', borderRadius: 8, padding: '8px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {saving ? 'Creazione...' : 'Crea e apri editor →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>📋 Assegna scheda esistente</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Usa un programma che hai già creato</div>
                {!assigning ? (
                  <button onClick={() => setAssigning(true)} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>Scegli dalla libreria</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <select value={selectedProgram} onChange={e => setSelectedProgram(e.target.value)} style={{ ...inputStyle, fontSize: 13, cursor: 'pointer' }}>
                      <option value="">Seleziona programma...</option>
                      {programs.map(p => <option key={p.id} value={p.id}>{p.name} — {p.total_weeks} sett.</option>)}
                    </select>
                    <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dalla settimana n°</div>
                      <input type="number" min="1" max="52" value={startWeek} onChange={e => setStartWeek(parseInt(e.target.value))} style={{ ...inputStyle, fontSize: 13 }} /></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setAssigning(false)} style={{ flex: 1, background: 'none', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>Annulla</button>
                      <button onClick={assignProgram} disabled={!selectedProgram} style={{ flex: 2, background: selectedProgram ? 'var(--accent)' : 'var(--surface2)', color: selectedProgram ? '#0C0D10' : 'var(--text3)', border: 'none', borderRadius: 8, padding: '8px', fontSize: 13, fontWeight: 600, cursor: selectedProgram ? 'pointer' : 'not-allowed' }}>Assegna</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== ALLENAMENTI (ex Storico) ===== */}
        {tab === 'storico' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 16 }}>Storico allenamenti</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                Tutti i pesi inseriti da {client.name.split(' ')[0]} durante le sessioni
              </div>
            </div>

            {/* Raggruppato per esercizio con PR evidenziati */}
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 13 }}>Nessun allenamento registrato ancora</div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Progressione per esercizio</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Object.entries(
                      logs.reduce((acc: any, l) => {
                        const name = getExerciseName(l)
                        if (!acc[name]) acc[name] = []
                        acc[name].push(l)
                        return acc
                      }, {})
                    ).map(([exName, exLogs]: [string, any]) => {
                      const maxKg = Math.max(...exLogs.map((l: any) => l.kg || 0))
                      const sortedLogs = [...exLogs].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
                      return (
                        <div key={exName} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{exName}</span>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{exLogs.length} serie totali</span>
                              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>PR: {maxKg} kg</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                            {sortedLogs.filter((l, i, arr) => i === 0 || l.set_num === 1).slice(0, 10).map((log: any) => {
                              const isPR = log.kg === maxKg
                              return (
                                <div key={log.id} style={{
                                  flexShrink: 0, background: isPR ? 'rgba(180,255,79,0.1)' : 'var(--surface2)',
                                  border: `1px solid ${isPR ? 'rgba(180,255,79,0.3)' : 'var(--border)'}`,
                                  borderRadius: 8, padding: '8px 12px', textAlign: 'center', minWidth: 72
                                }}>
                                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 15, color: isPR ? 'var(--accent)' : 'var(--text)', fontWeight: 500 }}>{log.kg}kg</div>
                                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>×{log.reps_done || '?'} · S{log.week_num}</div>
                                  {isPR && <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>🏆 PR</div>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tabella completa */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14 }}>Log completo</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Ogni riga = una serie completata durante una sessione</div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {[
                            { h: 'Esercizio', info: '' },
                            { h: 'Settimana', info: 'Del programma' },
                            { h: 'Set n°', info: '' },
                            { h: 'Kg usati', info: '' },
                            { h: 'Reps fatte', info: '' },
                            { h: 'Data sessione', info: '' },
                          ].map(({ h }) => (
                            <th key={h} style={{ textAlign: 'left', fontSize: 10.5, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {logs.slice(0, 100).map(log => (
                          <tr key={log.id}
                            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)'}
                            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                          >
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>{getExerciseName(log)}</td>
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>Sett. {log.week_num}</td>
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>Set {log.set_num}</td>
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'var(--font-dm-mono)', fontSize: 13, fontWeight: 500 }}>{log.kg} kg</td>
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>{log.reps_done || '—'}</td>
                            <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12 }}>{new Date(log.logged_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 16 }}>Misurazioni corporee</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                  Traccia le circonferenze corporee nel tempo per misurare i cambiamenti fisici
                </div>
              </div>
              <button onClick={() => setAddingMeasurement(true)} style={{
                background: 'var(--accent)', color: '#0C0D10', border: 'none',
                borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>+ Nuova rilevazione</button>
            </div>

            {/* Form nuova misurazione */}
            {addingMeasurement && (
              <div style={{ background: 'var(--surface)', border: '1px solid rgba(180,255,79,0.3)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 15 }}>Nuova rilevazione misurazioni</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Inserisci solo i valori che hai misurato, gli altri lascia vuoti</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Data misurazione</div>
                    <input type="date" value={newMeasurement.measured_at}
                      onChange={e => setNewMeasurement({ ...newMeasurement, measured_at: e.target.value })}
                      style={{ ...inputStyle, width: 160, fontSize: 13 }} />
                  </div>
                </div>

                {measureGroups.map(group => (
                  <div key={group.id} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ height: 1, flex: 1, background: 'rgba(180,255,79,0.2)' }} />
                      {group.label}
                      <div style={{ height: 1, flex: 1, background: 'rgba(180,255,79,0.2)' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                      {measureFields.filter(f => f.group === group.id).map(field => (
                        <div key={field.key}>
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }}>
                            {field.label}
                            <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 4 }}>({field.unit})</span>
                          </div>
                          <input
                            type="number" step="0.1" min="0"
                            placeholder="—"
                            value={(newMeasurement as any)[field.key]}
                            onChange={e => setNewMeasurement({ ...newMeasurement, [field.key]: e.target.value })}
                            style={{ ...inputStyle, fontSize: 14 }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }}>Note aggiuntive (opzionale)</div>
                  <input placeholder="es. misurato a digiuno, dopo allenamento, ecc."
                    value={newMeasurement.notes}
                    onChange={e => setNewMeasurement({ ...newMeasurement, notes: e.target.value })}
                    style={{ ...inputStyle, fontSize: 13 }} />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setAddingMeasurement(false)} style={{ flex: 1, background: 'none', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>Annulla</button>
                  <button onClick={saveMeasurement} style={{ flex: 2, background: 'var(--accent)', color: '#0C0D10', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salva misurazione</button>
                </div>
              </div>
            )}

            {/* Storico misurazioni */}
            {measurements.length === 0 && !addingMeasurement ? (
              <div style={{ textAlign: 'center', padding: '60px 0', background: 'var(--surface)', border: '1px dashed var(--border2)', borderRadius: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📏</div>
                <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 6 }}>Nessuna misurazione ancora</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>Aggiungi la prima per iniziare a tracciare i progressi fisici</div>
                <button onClick={() => setAddingMeasurement(true)} style={{ background: 'var(--accent)', color: '#0C0D10', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Prima rilevazione</button>
              </div>
            ) : measurements.length > 0 && (
              <div>
                {/* Confronto prima/ultima */}
                {measurements.length >= 2 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Variazioni nel tempo</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                      Confronto tra la prima ({new Date(measurements[measurements.length - 1].measured_at).toLocaleDateString('it-IT')}) e l'ultima rilevazione ({new Date(measurements[0].measured_at).toLocaleDateString('it-IT')})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                      {measureFields.map(field => {
                        const first = measurements[measurements.length - 1][field.key]
                        const last = measurements[0][field.key]
                        if (!first && !last) return null
                        const delta = first && last ? (last - first).toFixed(1) : null
                        const isGood = delta !== null && (
                          (field.key === 'weight' && parseFloat(delta) < 0) ||
                          (field.key !== 'weight' && parseFloat(delta) > 0) ? false :
                            field.key === 'weight' ? parseFloat(delta) < 0 : true
                        )
                        return (
                          <div key={field.key} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{field.label}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 16, color: 'var(--text)', fontWeight: 500 }}>{last || first} {field.unit}</span>
                              {delta && (
                                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: parseFloat(delta) > 0 ? 'var(--accent)' : 'var(--red)', fontWeight: 500 }}>
                                  {parseFloat(delta) > 0 ? '+' : ''}{delta}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      }).filter(Boolean)}
                    </div>
                  </div>
                )}

                {/* Tabella storico */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Tutte le rilevazioni</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', fontSize: 10, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Data</th>
                          {measureFields.map(f => (
                            <th key={f.key} style={{ textAlign: 'center', fontSize: 9, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 6px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{f.label.replace(' destro', ' dx').replace(' sinistro', ' sx').replace(' destra', ' dx').replace(' sinistra', ' sx')}</th>
                          ))}
                          <th style={{ textAlign: 'left', fontSize: 10, color: 'var(--text3)', fontWeight: 500, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Note</th>
                          <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {measurements.map(m => (
                          <tr key={m.id}
                            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)'}
                            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                          >
                            <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap', fontWeight: 500 }}>
                              {new Date(m.measured_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </td>
                            {measureFields.map(f => (
                              <td key={f.key} style={{ padding: '9px 6px', borderBottom: '1px solid var(--border)', color: m[f.key] ? 'var(--text)' : 'var(--surface3)', fontFamily: 'var(--font-dm-mono)', fontSize: 12, textAlign: 'center' }}>
                                {m[f.key] ? `${m[f.key]}` : '—'}
                              </td>
                            ))}
                            <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: 11 }}>{m.notes || '—'}</td>
                            <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                              <button onClick={() => deleteMeasurement(m.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}
                                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'}
                                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'}
                              >✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== FOTO PROGRESS ===== */}
        {tab === 'foto' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 16 }}>Foto progress</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                  Foto del corpo con data per vedere i cambiamenti visivi nel tempo
                </div>
              </div>
            </div>

            {/* Form upload foto */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Carica nuova foto</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>Data foto</div>
                  <input type="date" value={photoDate} onChange={e => setPhotoDate(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>Descrizione (opzionale)</div>
                  <input placeholder="es. Fronte, Profilo, Schiena..." value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />
                </div>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} style={{
                  background: 'var(--accent)', color: '#0C0D10', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                }}>
                  {uploadingPhoto ? '⏳ Caricamento...' : '📸 Carica foto'}
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={uploadPhoto} style={{ display: 'none' }} />
            </div>

            {/* Confronto affiancato */}
            {photos.length >= 2 && (
              <div style={{ background: 'var(--surface)', border: '1px solid rgba(180,255,79,0.2)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Confronto affiancato</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Seleziona due foto per confrontarle</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Foto A (prima)</div>
                    <select value={compareA} onChange={e => setCompareA(e.target.value)} style={{ ...inputStyle, fontSize: 13, cursor: 'pointer' }}>
                      <option value="">Seleziona foto...</option>
                      {photos.map(p => <option key={p.id} value={p.id}>{new Date(p.photo_date).toLocaleDateString('it-IT')} {p.caption ? `— ${p.caption}` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Foto B (dopo)</div>
                    <select value={compareB} onChange={e => setCompareB(e.target.value)} style={{ ...inputStyle, fontSize: 13, cursor: 'pointer' }}>
                      <option value="">Seleziona foto...</option>
                      {photos.map(p => <option key={p.id} value={p.id}>{new Date(p.photo_date).toLocaleDateString('it-IT')} {p.caption ? `— ${p.caption}` : ''}</option>)}
                    </select>
                  </div>
                </div>
                {compareA && compareB && compareA !== compareB && (() => {
                  const photoA = photos.find(p => p.id === compareA)
                  const photoB = photos.find(p => p.id === compareB)
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {[photoA, photoB].map((photo, i) => photo && (
                        <div key={photo.id}>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, textAlign: 'center' }}>
                            {i === 0 ? 'Prima' : 'Dopo'} · {new Date(photo.photo_date).toLocaleDateString('it-IT')}
                            {photo.caption && ` · ${photo.caption}`}
                          </div>
                          <img src={photo.photo_url} alt="" style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 400, border: '1px solid var(--border)' }} />
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Galleria */}
            {photos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', background: 'var(--surface)', border: '1px dashed var(--border2)', borderRadius: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📸</div>
                <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 6 }}>Nessuna foto ancora</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Carica la prima foto progress per iniziare a tracciare i cambiamenti visivi</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Galleria — {photos.length} foto
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                  {photos.map(photo => (
                    <div key={photo.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ position: 'relative' }}>
                        <img src={photo.photo_url} alt={photo.caption || ''} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
                        <button onClick={() => deletePhoto(photo.id, photo.photo_url)} style={{
                          position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none',
                          borderRadius: '50%', width: 28, height: 28, color: 'white', cursor: 'pointer', fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>✕</button>
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {new Date(photo.photo_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        {photo.caption && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{photo.caption}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== NOTE TRAINER ===== */}
        {tab === 'note' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 16 }}>Note del trainer</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Annotazioni private visibili solo a te — tecnica, obiettivi, impressioni</div>
              </div>
              <button onClick={() => setAddingNote(true)} style={{ background: 'var(--accent)', color: '#0C0D10', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Aggiungi nota</button>
            </div>
            {addingNote && (
              <div style={{ background: 'var(--surface)', border: '1px solid rgba(180,255,79,0.3)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                <textarea autoFocus placeholder="Scrivi una nota su questo cliente (tecnica, progressi, comportamento, obiettivi futuri...)..."
                  value={newNote} onChange={e => setNewNote(e.target.value)}
                  style={{ ...inputStyle, minHeight: 100, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => { setAddingNote(false); setNewNote('') }} style={{ flex: 1, background: 'none', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>Annulla</button>
                  <button onClick={addNote} disabled={!newNote.trim()} style={{ flex: 2, background: newNote.trim() ? 'var(--accent)' : 'var(--surface2)', color: newNote.trim() ? '#0C0D10' : 'var(--text3)', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: newNote.trim() ? 'pointer' : 'not-allowed' }}>Salva nota</button>
                </div>
              </div>
            )}
            {notes.length === 0 && !addingNote ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 13 }}>Nessuna nota ancora</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notes.map(note => (
                  <div key={note.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(note.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      <button onClick={() => deleteNote(note.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}
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
                    <div>
                      <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 15 }}>Informazioni del cliente</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Dati anagrafici e obiettivi</div>
                    </div>
                    <button onClick={() => setEditing(true)} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>✏️ Modifica</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {[
                      { label: 'Nome completo', value: client.name },
                      { label: 'Email di accesso', value: client.email || '—' },
                      { label: 'Numero di telefono', value: client.phone || '—' },
                      { label: 'Data di nascita', value: client.birthdate ? new Date(client.birthdate).toLocaleDateString('it-IT') : '—' },
                      { label: 'Obiettivo principale', value: client.goal || '—' },
                      { label: 'Livello di esperienza', value: client.level || '—' },
                    ].map((f, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{f.label}</div>
                        <div style={{ fontSize: 14, color: f.value === '—' ? 'var(--text3)' : 'var(--text)', fontWeight: f.value === '—' ? 400 : 500 }}>{f.value}</div>
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

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 15 }}>Accesso all'app</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Le credenziali che il cliente usa per entrare</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Stato account', value: client.user_id ? '✓ Account attivo — può fare login' : '⚠ Nessun account — può usare solo il link', color: client.user_id ? 'var(--accent)' : 'var(--amber)' },
                      { label: 'Email di accesso', value: client.email || '—' },
                    ].map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 120 }}>{f.label}</span>
                        <span style={{ fontSize: 13, color: (f as any).color || 'var(--text2)' }}>{f.value}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 120 }}>Password</span>
                      <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)' }}>
                        {revealPassword ? (client.temp_password || '(già cambiata dal cliente)') : '••••••••'}
                      </span>
                      <button onClick={() => setRevealPassword(!revealPassword)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}>
                        {revealPassword ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    <button onClick={copyCredentials} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer', fontWeight: 500 }}>
                      📱 Copia messaggio WhatsApp con credenziali
                    </button>
                    <button onClick={copyLink} style={{ flex: 1, background: 'rgba(180,255,79,0.08)', border: '1px solid rgba(180,255,79,0.2)', borderRadius: 8, padding: '10px', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>
                      🔗 Copia link accesso diretto
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={saveClient}>
                <div style={{ background: 'var(--surface)', border: '1px solid rgba(180,255,79,0.2)', borderRadius: 14, padding: 24 }}>
                  <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 15, marginBottom: 20 }}>Modifica informazioni</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    {[
                      { key: 'name', label: 'Nome completo *', type: 'text', required: true },
                      { key: 'email', label: 'Email', type: 'email', required: false },
                      { key: 'phone', label: 'Telefono', type: 'tel', required: false },
                      { key: 'birthdate', label: 'Data di nascita', type: 'date', required: false },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>{f.label}</label>
                        <input required={f.required} type={f.type} style={inputStyle}
                          value={editForm[f.key] || ''}
                          onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} />
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Obiettivo</label>
                      <select style={{ ...inputStyle, cursor: 'pointer' }} value={editForm.goal || ''} onChange={e => setEditForm({ ...editForm, goal: e.target.value })}>
                        <option value="">Seleziona...</option>
                        <option>Ipertrofia</option><option>Forza</option><option>Dimagrimento</option><option>Tonificazione</option><option>Resistenza</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Livello</label>
                      <select style={{ ...inputStyle, cursor: 'pointer' }} value={editForm.level || ''} onChange={e => setEditForm({ ...editForm, level: e.target.value })}>
                        <option>Principiante</option><option>Intermedio</option><option>Avanzato</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Note generali sul cliente</label>
                    <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                      value={editForm.notes || ''}
                      onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Informazioni utili: patologie, preferenze, limitazioni fisiche, storico..." />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => setEditing(false)} style={{ flex: 1, background: 'none', border: '1px solid var(--border2)', borderRadius: 8, padding: '11px', fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>Annulla</button>
                    <button type="submit" disabled={saving} style={{ flex: 2, background: 'var(--accent)', color: '#0C0D10', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.8 : 1 }}>
                      {saving ? 'Salvataggio...' : 'Salva modifiche'}
                    </button>
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
