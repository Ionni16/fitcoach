'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function Progressi() {
  const supabase = createClient()
  const [clients, setClients] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('clients').select('*')
      setClients(c || [])
      const { data: l } = await supabase
        .from('weight_logs')
        .select('*, exercises(id, name, week_progressions(name, week_num)), clients(name)')
        .order('logged_at', { ascending: false })
        .limit(100)
      setLogs(l || [])
    }
    load()
  }, [])

  function getExerciseName(log: any) {
    const weekProgs = log.exercises?.week_progressions || []
    const match = weekProgs.find((wp: any) => wp.week_num === log.week_num)
    return match?.name || log.exercises?.name || '—'
  }

  const totalProgressions = logs.filter((l, _, arr) => {
    const prev = arr.find(p =>
      p.exercise_id === l.exercise_id &&
      p.set_num === l.set_num &&
      p.week_num === l.week_num - 1 &&
      p.client_id === l.client_id
    )
    return prev && l.kg > prev.kg
  }).length

  return (
    <div>
      <div style={{
        padding: '16px 28px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)'
      }}>
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 17 }}>Progressi</span>
      </div>

      <div style={{ padding: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Clienti totali', value: clients.length },
            { label: 'Sessioni loggate', value: new Set(logs.map(l => l.client_id + l.week_num + l.logged_at?.slice(0, 10))).size },
            { label: 'Progressioni', value: totalProgressions },
            { label: 'Pesi inseriti', value: logs.length },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '18px 20px'
            }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 32, fontWeight: 500, color: i === 2 ? 'var(--accent)' : 'var(--text)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Ultimi pesi loggati — tutti i clienti</div>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>Nessun dato ancora — inizia una sessione con un cliente</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Cliente', 'Esercizio', 'Sett.', 'Set', 'Kg', 'Reps', 'Data'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {logs.slice(0, 30).map(log => (
                  <tr key={log.id}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>{log.clients?.name}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: 13 }}>{getExerciseName(log)}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>{log.week_num}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontFamily: 'var(--font-dm-mono)', fontSize: 13 }}>{log.set_num}</td>
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
    </div>
  )
}
