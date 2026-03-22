'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ClienteRedirect() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: client } = await supabase
        .from('clients')
        .select('access_token')
        .eq('user_id', user.id)
        .single()

      if (client?.access_token) {
        router.push(`/cliente/${client.access_token}`)
      } else {
        router.push('/login')
      }
    }
    redirect()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: '#0C0D10', display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12
    }}>
      <div style={{ width: 40, height: 40, background: '#B4FF4F', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="6" width="14" height="4" rx="2" fill="#0C0D10"/>
          <rect x="4" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
          <rect x="9.5" y="3" width="2.5" height="10" rx="1.25" fill="#0C0D10"/>
        </svg>
      </div>
      <div style={{ color: '#50535C', fontSize: 13 }}>Caricamento area personale...</div>
    </div>
  )
}

