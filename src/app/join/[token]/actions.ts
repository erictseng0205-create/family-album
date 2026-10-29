'use server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { createSession } from '@/lib/auth'

export async function acceptInvite(form: FormData) {
  const token = String(form.get('token') ?? '')
  if (!token) redirect('/welcome')
  const sb = createAdminClient()
  const { data: inv } = await sb.from('invites').select('token, name, role, expires_at, member_id').eq('token', token).maybeSingle()
  if (!inv || new Date(inv.expires_at).getTime() < Date.now()) redirect(`/join/${token}`)

  let memberId = inv.member_id as string | null
  if (memberId) {
    const { data: m } = await sb.from('members').select('revoked_at').eq('id', memberId).maybeSingle()
    if (!m || m.revoked_at) redirect(`/join/${token}`)
  } else {
    const { data: m, error } = await sb.from('members').insert({ name: inv.name, role: inv.role }).select('id').single()
    if (error) throw new Error(error.message)
    memberId = m.id
    await sb.from('invites').update({ member_id: memberId }).eq('token', token)
  }
  const ua = (await headers()).get('user-agent')
  await createSession(memberId!, ua)
  redirect('/')
}
