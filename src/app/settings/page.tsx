import { requireMember } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { visibleAlbums } from '@/lib/db'
import { appUrl } from '@/lib/config'
import Shell from '@/components/shell'
import { logout, createInvite, deleteInvite, revokeMember, restoreMember, saveAlbum } from './actions'
import CopyButton from './copy-button'

export const dynamic = 'force-dynamic'

export default async function Settings() {
  const member = await requireMember()
  const albums = await visibleAlbums(member)
  const isAdmin = member.role === 'admin'
  const sb = createAdminClient()
  const [{ data: invites }, { data: members }] = isAdmin
    ? await Promise.all([
        sb.from('invites').select('token, name, role, expires_at, member_id, created_at').order('created_at', { ascending: false }),
        sb.from('members').select('id, name, role, created_at, last_seen_at, revoked_at').order('created_at'),
      ])
    : [{ data: [] }, { data: [] }]
  const now = Date.now()

  return (
    <Shell member={member} albums={albums} showTabs={false}>
      <h1 className="text-lg font-bold mb-3">設定</h1>

      <section className="bg-card border border-line rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{member.name}</div>
            <div className="text-xs text-muted">{isAdmin ? '管理員' : '家人'}</div>
          </div>
          <form action={logout}><button className="px-3 py-1.5 rounded-full border border-line text-sm">登出</button></form>
        </div>
        <p className="text-xs text-muted mt-3">想像 App 一樣用:iPhone 用 Safari 打開 → 分享 → 加入主畫面;Android 用 Chrome → 右上 ⋮ → 加到主畫面。</p>
      </section>

      {isAdmin && (
        <>
          <section className="bg-card border border-line rounded-2xl p-4 mb-4">
            <h2 className="font-semibold mb-2">邀請家人</h2>
            <form action={createInvite} className="flex gap-2 mb-3">
              <input name="name" required maxLength={30} placeholder="名字(例:阿嬤)" className="flex-1 rounded-xl border border-line px-3 py-2 text-[16px]" />
              <select name="role" className="rounded-xl border border-line px-2 text-sm">
                <option value="family">家人</option>
                <option value="admin">管理員</option>
              </select>
              <button className="px-3 py-2 rounded-xl bg-brand text-white text-sm">產生</button>
            </form>
            <p className="text-xs text-muted mb-2">家人只看得到小孩的相簿;管理員什麼都看得到。連結 7 天內有效,同一個人可以在手機和平板各開一次。</p>
            <ul className="space-y-2">
              {(invites ?? []).map((inv) => {
                const url = `${appUrl()}/join/${inv.token}`
                const expired = new Date(inv.expires_at).getTime() < now
                return (
                  <li key={inv.token} className="border border-line rounded-xl px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{inv.name}</span>
                      <span className="text-xs text-muted">{inv.role === 'admin' ? '管理員' : '家人'}</span>
                      <span className="text-xs text-muted ml-auto">{expired ? '已過期' : inv.member_id ? '已使用' : '未使用'}</span>
                    </div>
                    {!expired && (
                      <div className="flex gap-2 mt-2">
                        <CopyButton text={url} />
                        <a href={`https://line.me/R/share?text=${encodeURIComponent(`${inv.name},這是我們家的相簿邀請連結:${url}`)}`} className="px-3 py-1 rounded-full bg-[#06C755] text-white text-xs">用 LINE 傳</a>
                        <form action={deleteInvite} className="ml-auto"><input type="hidden" name="token" value={inv.token} /><button className="text-xs text-muted">刪除</button></form>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="bg-card border border-line rounded-2xl p-4 mb-4">
            <h2 className="font-semibold mb-2">成員</h2>
            <ul className="space-y-2">
              {(members ?? []).map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm border border-line rounded-xl px-3 py-2">
                  <span className={m.revoked_at ? 'line-through text-muted' : 'font-medium'}>{m.name}</span>
                  <span className="text-xs text-muted">{m.role === 'admin' ? '管理員' : '家人'}</span>
                  <span className="text-xs text-muted ml-auto">{m.last_seen_at ? `最近 ${new Date(m.last_seen_at).toLocaleDateString('zh-TW')}` : '還沒來過'}</span>
                  {m.id !== member.id && (
                    m.revoked_at ? (
                      <form action={restoreMember}><input type="hidden" name="id" value={m.id} /><button className="text-xs text-brand-deep">恢復</button></form>
                    ) : (
                      <form action={revokeMember}><input type="hidden" name="id" value={m.id} /><button className="text-xs text-red-600">停用</button></form>
                    )
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-card border border-line rounded-2xl p-4 mb-4">
            <h2 className="font-semibold mb-2">相簿</h2>
            <div className="space-y-3">
              {albums.map((a) => <AlbumForm key={a.id} a={a} />)}
              <details className="border border-dashed border-line rounded-xl px-3 py-2">
                <summary className="text-sm text-brand-deep cursor-pointer">＋ 新增相簿</summary>
                <AlbumForm a={null} />
              </details>
            </div>
          </section>
        </>
      )}
    </Shell>
  )
}

function AlbumForm({ a }: { a: { id: string; name: string; birthday: string | null; visibility: string; sort: number } | null }) {
  return (
    <form action={saveAlbum} className="grid grid-cols-2 gap-2 text-sm border border-line rounded-xl px-3 py-2">
      <input type="hidden" name="id" value={a?.id ?? ''} />
      <label className="col-span-2">名稱<input name="name" required defaultValue={a?.name ?? ''} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-[16px]" /></label>
      <label>生日(算年齡用)<input type="date" name="birthday" defaultValue={a?.birthday ?? ''} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-[16px]" /></label>
      <label>誰看得到
        <select name="visibility" defaultValue={a?.visibility ?? 'family'} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-[16px]">
          <option value="family">全家</option>
          <option value="admins">只有管理員</option>
        </select>
      </label>
      <label>排序(小的在前)<input type="number" name="sort" defaultValue={a?.sort ?? 0} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-[16px]" /></label>
      <div className="flex items-end"><button className="w-full py-1.5 rounded-lg bg-brand text-white">{a ? '儲存' : '新增'}</button></div>
    </form>
  )
}
