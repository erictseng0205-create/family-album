'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin, requireMember, destroySession, newToken } from '@/lib/auth'

export async function logout() {
  await requireMember()
  await destroySession()
  redirect('/welcome')
}

export async function createInvite(form: FormData) {
  const admin = await requireAdmin()
  const name = String(form.get('name') ?? '').trim().slice(0, 30)
  const role = form.get('role') === 'admin' ? 'admin' : 'family'
  if (!name) return
  const sb = createAdminClient()
  await sb.from('invites').insert({ token: newToken(12), name, role, created_by: admin.id })
  revalidatePath('/settings')
}

export async function deleteInvite(form: FormData) {
  await requireAdmin()
  const token = String(form.get('token') ?? '')
  await createAdminClient().from('invites').delete().eq('token', token)
  revalidatePath('/settings')
}

export async function revokeMember(form: FormData) {
  const admin = await requireAdmin()
  const id = String(form.get('id') ?? '')
  if (!id || id === admin.id) return
  const sb = createAdminClient()
  await sb.from('members').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  await sb.from('sessions').delete().eq('member_id', id)
  revalidatePath('/settings')
}

export async function restoreMember(form: FormData) {
  await requireAdmin()
  const id = String(form.get('id') ?? '')
  await createAdminClient().from('members').update({ revoked_at: null }).eq('id', id)
  revalidatePath('/settings')
}

export async function saveAlbum(form: FormData) {
  await requireAdmin()
  const id = String(form.get('id') ?? '')
  const name = String(form.get('name') ?? '').trim().slice(0, 30)
  const birthday = String(form.get('birthday') ?? '')
  const visibility = form.get('visibility') === 'admins' ? 'admins' : 'family'
  const sort = Number(form.get('sort') ?? 0) || 0
  if (!name) return
  const row = { name, birthday: /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? birthday : null, visibility, sort }
  const sb = createAdminClient()
  if (id) await sb.from('albums').update(row).eq('id', id)
  else await sb.from('albums').insert({ ...row, slug: `a-${newToken(6).toLowerCase()}` })
  revalidatePath('/settings')
  revalidatePath('/')
}
