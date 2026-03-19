'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5"/>
    </svg>
  )},
  { href: '/dashboard/clienti', label: 'Clienti', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="5" r="3"/>
      <path d="M2 13c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  )},
  { href: '/dashboard/schede', label: 'Schede', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 8h6M5 5h6M5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )},
  { href: '/dashboard/progressi', label: 'Progressi', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <polyline points="2,12 5,7 8,9 11,4 14,6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [trainerName, setTrainerName] = useState('')

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setTrainerName(user.email?.split('@')[0] || 'Trainer')
    }
    check()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = trainerName.slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '20px 0 16px'
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '0 18px 24px', borderBottom: '1px solid var(--border)', marginBottom: 16
        }}>
          <div style={{
            width: 30, height: 30, background: 'var(--accent)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="6" width="14" height="4" rx="2" fill="#0C0D10"/>
              <rect x="4" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
              <rect x="9.5" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
            </svg>
          </div>
          <span style={{
            fontFamily: 'var(--font-syne)', fontWeight: 800, fontSize: 15, color: 'var(--text)'
          }}>
            Fit<span style={{ color: 'var(--accent)' }}>Coach</span>
          </span>
        </div>

        {/* Nav */}
        <div style={{ padding: '0 10px', flex: 1 }}>
          <div style={{
            fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em',
            textTransform: 'uppercase', padding: '0 8px', marginBottom: 6, fontWeight: 500
          }}>Trainer</div>
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <button key={item.href} onClick={() => router.push(item.href)} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px',
                borderRadius: 8, fontSize: 13.5, width: '100%', textAlign: 'left',
                border: 'none', cursor: 'pointer', marginBottom: 2, transition: 'all 0.15s',
                background: isActive ? 'rgba(180,255,79,0.12)' : 'none',
                color: isActive ? 'var(--accent)' : 'var(--text2)',
              }}>
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Footer trainer */}
        <div style={{ padding: '12px 10px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'rgba(180,255,79,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, color: 'var(--accent)', flexShrink: 0
            }}>{initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{trainerName}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Personal Trainer</div>
            </div>
            <button onClick={logout} title="Esci" style={{
              background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16
            }}>↩</button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}