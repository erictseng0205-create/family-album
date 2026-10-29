import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { getMember } from '@/lib/auth'
import { APP_NAME } from '@/lib/config'
import { acceptInvite } from './actions'

export const dynamic = 'force-dynamic'

// 邀請連結:先顯示「嗨,某某」再按一下才真的登入(LINE 預覽連結時不會把邀請用掉)
export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const sb = createAdminClient()
  const { data: inv } = await sb
    .from('invites')
    .select('token, name, role, expires_at, member_id, members(revoked_at)')
    .eq('token', token)
    .maybeSingle()
  const invite = inv as unknown as { token: string; name: string; role: string; expires_at: string; member_id: string | null; members: { revoked_at: string | null } | null } | null
  const expired = !invite || new Date(invite.expires_at).getTime() < Date.now() || !!invite.members?.revoked_at

  const me = await getMember()
  if (me && invite && invite.member_id === me.id) redirect('/')

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-4">🏠</div>
      <h1 className="text-2xl font-bold text-brand-deep mb-3">{APP_NAME}</h1>
      {expired ? (
        <p className="text-muted">這個邀請連結已經失效了,請再跟 Eric 要一個新的。</p>
      ) : (
        <form action={acceptInvite} className="space-y-4">
          <input type="hidden" name="token" value={invite!.token} />
          <p className="text-lg">嗨,{invite!.name}!</p>
          <button className="px-8 py-3 rounded-full bg-brand text-white text-lg font-semibold active:bg-brand-deep">進入相簿</button>
          <p className="text-xs text-muted">進去之後可以把這個網頁「加到主畫面」,以後像 App 一樣打開。</p>
        </form>
      )}
    </main>
  )
}
