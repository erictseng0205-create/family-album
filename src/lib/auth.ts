import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from './supabase-admin'

export const COOKIE = 'fa_session'

export type Member = {
  id: string
  name: string
  role: 'admin' | 'family'
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function newToken(bytes = 24) {
  return randomBytes(bytes).toString('base64url')
}

// 這次請求是誰:看 cookie 裡的 token,對 sessions 表
export const getMember = cache(async (): Promise<Member | null> => {
  const raw = (await cookies()).get(COOKIE)?.value
  if (!raw) return null
  const sb = createAdminClient()
  const { data } = await sb
    .from('sessions')
    .select('token_hash, last_seen_at, members!inner(id, name, role, revoked_at)')
    .eq('token_hash', hashToken(raw))
    .maybeSingle()
  const m = (data as unknown as { members: { id: string; name: string; role: 'admin' | 'family'; revoked_at: string | null }; last_seen_at: string } | null)?.members
  if (!m || m.revoked_at) return null
  // 一天記一次「最近出現」,不用每次都寫
  const seen = new Date((data as unknown as { last_seen_at: string }).last_seen_at).getTime()
  if (Date.now() - seen > 86400000) {
    await sb.from('sessions').update({ last_seen_at: new Date().toISOString() }).eq('token_hash', hashToken(raw))
    await sb.from('members').update({ last_seen_at: new Date().toISOString() }).eq('id', m.id)
  }
  return { id: m.id, name: m.name, role: m.role }
})

export async function requireMember(): Promise<Member> {
  const m = await getMember()
  if (!m) redirect('/welcome')
  return m
}

export async function requireAdmin(): Promise<Member> {
  const m = await requireMember()
  if (m.role !== 'admin') redirect('/')
  return m
}

// 建一個新的登入狀態,把 cookie 設好(只能在 server action / route handler 裡叫)
export async function createSession(memberId: string, userAgent?: string | null) {
  const token = newToken()
  const sb = createAdminClient()
  const { error } = await sb.from('sessions').insert({
    token_hash: hashToken(token),
    member_id: memberId,
    user_agent: userAgent?.slice(0, 300) ?? null,
  })
  if (error) throw new Error(error.message)
  await sb.from('members').update({ last_seen_at: new Date().toISOString() }).eq('id', memberId)
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365 * 2, // 兩年
  })
}

export async function destroySession() {
  const store = await cookies()
  const raw = store.get(COOKIE)?.value
  if (raw) {
    await createAdminClient().from('sessions').delete().eq('token_hash', hashToken(raw))
  }
  store.delete(COOKIE)
}
