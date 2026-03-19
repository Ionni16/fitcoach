'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'

export default function PdfPage() {
  const supabase = createClient()
  const { token } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('clients').select('*').eq('access_token', token).single()
      if (!c) return
      const { data: cp } = await supabase.from('client_programs')
        .select('*, programs(*)').eq('client_id', c.id).eq('is_active', true).single()
      if (!cp) return
      const { data: sess } = await supabase.from('sessions')
        .select('*').eq('program_id', cp.program_id).order('day_index')
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
      setData({ client: c, program: cp.programs, clientProgram: cp, sessions: sess || [], exMap, progMap })
      setLoading(false)
    }
    load()
  }, [token])

  useEffect(() => {
    if (!loading && data) setTimeout(() => window.print(), 800)
  }, [loading, data])

  if (loading || !data) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Preparazione PDF...</div>

  const { client, program, clientProgram, sessions, exMap, progMap } = data
  const totalWeeks = program.total_weeks || 4

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 15mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
          .no-print { display: none; }
        }
        body { font-family: 'Arial', sans-serif; color: #1a1a1a; background: white; margin: 0; padding: 0; }
        .header { background: #0C0D10; color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .logo span { color: #B4FF4F; }
        .client-info { text-align: right; font-size: 12px; color: #8A8D96; }
        .client-name { font-size: 16px; color: white; font-weight: 600; }
        .program-info { background: #f8f8f6; border-bottom: 2px solid #B4FF4F; padding: 16px 32px; display: flex; gap: 32px; align-items: center; }
        .prog-title { font-size: 18px; font-weight: 700; color: #0C0D10; }
        .prog-meta { font-size: 12px; color: #666; margin-top: 2px; }
        .prog-badge { background: #B4FF4F; color: #0C0D10; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .week-section { padding: 20px 32px 0; }
        .week-title { font-size: 14px; font-weight: 700; color: #0C0D10; background: #f0f0ee; padding: 8px 14px; border-radius: 6px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .week-badge { background: #B4FF4F; color: #0C0D10; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
        .deload-badge { background: #FFB84F; color: #0C0D10; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
        .day-card { border: 1px solid #e5e5e3; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
        .day-header { background: #0C0D10; color: white; padding: 8px 14px; font-size: 12px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8f8f6; text-align: left; font-size: 10px; color: #888; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 14px; border-bottom: 1px solid #e5e5e3; }
        td { padding: 8px 14px; font-size: 12px; border-bottom: 1px solid #f0f0ee; color: #333; }
        tr:last-child td { border-bottom: none; }
        .ex-num { color: #999; font-size: 11px; width: 24px; }
        .ex-name { font-weight: 500; color: #0C0D10; }
        .ex-note { font-size: 10px; color: #B85F00; font-style: italic; }
        .tag-val { font-family: monospace; font-size: 12px; font-weight: 600; color: #0C0D10; }
        .log-box { width: 50px; height: 20px; border: 1px solid #ddd; border-radius: 4px; display: inline-block; }
        .footer { padding: 16px 32px; margin-top: 20px; border-top: 1px solid #e5e5e3; display: flex; justify-content: space-between; font-size: 10px; color: #999; }
      `}</style>

      {/* HEADER */}
      <div className="header">
        <div>
          <div className="logo">Fit<span>Coach</span></div>
          <div style={{ fontSize: 11, color: '#8A8D96', marginTop: 2 }}>Piano di allenamento personalizzato</div>
        </div>
        <div className="client-info">
          <div className="client-name">{client.name}</div>
          <div>{program.goal} · {program.level}</div>
          <div>Generato il {new Date().toLocaleDateString('it-IT')}</div>
        </div>
      </div>

      {/* PROGRAM INFO */}
      <div className="program-info">
        <div>
          <div className="prog-title">{program.name}</div>
          <div className="prog-meta">{program.days_per_week} giorni/settimana · {totalWeeks} settimane totali · Sett. corrente: {clientProgram.current_week}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span className="prog-badge">{program.goal}</span>
          <span className="prog-badge" style={{ background: '#e5e5e3', color: '#333' }}>{program.level}</span>
        </div>
      </div>

      {/* SETTIMANE */}
      {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w, wi) => {
        const isDeload = w === totalWeeks
        return (
          <div key={w} className={wi > 0 && wi % 2 === 0 ? 'page-break' : ''}>
            <div className="week-section">
              <div className="week-title">
                Settimana {w}
                {isDeload ? <span className="deload-badge">🔄 SCARICO</span> : <span className="week-badge">SETT. {w}</span>}
                {w === clientProgram.current_week && <span style={{ fontSize: 10, color: '#B4FF4F', background: '#0C0D10', padding: '2px 8px', borderRadius: 4 }}>← CORRENTE</span>}
              </div>

              {isDeload && (
                <div style={{ background: '#FFF8E6', border: '1px solid #FFB84F', borderRadius: 6, padding: '8px 14px', fontSize: 11, color: '#B85F00', marginBottom: 10 }}>
                  Settimana di scarico: dimezza tutte le serie mantenendo gli stessi carichi della settimana precedente.
                </div>
              )}

              {sessions.map((sess: any) => {
                const exs = exMap[sess.id] || []
                const allProgs = progMap[sess.id] || []
                return (
                  <div key={sess.id} className="day-card">
                    <div className="day-header">{sess.name}</div>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 24 }}>#</th>
                          <th>Esercizio</th>
                          <th style={{ width: 60 }}>Serie</th>
                          <th style={{ width: 70 }}>Reps</th>
                          <th style={{ width: 60 }}>Buffer</th>
                          <th style={{ width: 70 }}>Recupero</th>
                          <th style={{ width: 80 }}>Kg usati</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exs.map((ex: any, idx: number) => {
                          const prog = allProgs.find((p: any) => p.exercise_id === ex.id && p.week_num === w)
                          return (
                            <tr key={ex.id}>
                              <td className="ex-num">{idx + 1}</td>
                              <td>
                                <div className="ex-name">{prog?.name || ex.name}</div>
                                {prog?.notes && <div className="ex-note">→ {prog.notes}</div>}
                              </td>
                              <td><span className="tag-val">{isDeload ? Math.ceil((prog?.sets || ex.sets) / 2) : (prog?.sets || ex.sets)}</span></td>
                              <td><span className="tag-val">{prog?.reps || ex.reps}</span></td>
                              <td><span className="tag-val">{prog?.rir ?? ex.rir}</span></td>
                              <td style={{ fontSize: 11, color: '#666' }}>
                                {ex.rest_seconds ? `${Math.floor(ex.rest_seconds / 60)}′${ex.rest_seconds % 60 > 0 ? String(ex.rest_seconds % 60).padStart(2,'0') + '″' : ''}` : '—'}
                              </td>
                              <td><div className="log-box" /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="footer">
        <span>FitCoach — Piano personalizzato per {client.name}</span>
        <span>{program.name} · Generato il {new Date().toLocaleDateString('it-IT')}</span>
      </div>

      <div className="no-print" style={{ textAlign: 'center', padding: 20 }}>
        <button onClick={() => window.print()} style={{
          background: '#B4FF4F', border: 'none', borderRadius: 8,
          padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
        }}>🖨️ Stampa / Salva PDF</button>
      </div>
    </>
  )
}