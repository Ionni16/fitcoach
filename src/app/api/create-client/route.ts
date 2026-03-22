import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { name, email, password, goal, level, trainerId } = await req.json()

  // 1. Crea utente in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'client' }
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // 2. Crea record client collegato all'utente auth
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .insert({
        name,
        email,
        goal,
        level,
        trainer_id: trainerId,
        user_id: authData.user.id,
        access_token: crypto.randomUUID(),
        temp_password: password
    })
    .select()
    .single()

  if (clientError) {
    // Rollback: elimina utente auth se client insert fallisce
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: clientError.message }, { status: 400 })
  }

  return NextResponse.json({ client, userId: authData.user.id })
}