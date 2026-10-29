import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { getMoment } from '@/lib/db'
import { ageLabel, fmtDate } from '@/lib/age'
import MediaStrip from '@/components/media-strip'
import { toggleLike, addComment, deleteComment, shareToLine, deleteMoment } from './actions'
import DeleteButton from './delete-button'

export const dynamic = 'force-dynamic'

export default async function MomentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const member = await requireMember()
  const m = await getMoment(id, member)
  if (!m) notFound()
  const age = ageLabel(m.album.birthday, m.taken_on)
  const liked = m.likedBy.some((l) => l.member_id === member.id)
  const canEdit = member.role === 'admin' || m.author_id === member.id

  return (
    <main className="min-h-dvh max-w-xl mx-auto pb-24">
      <header className="sticky top-0 z-10 bg-paper/90 backdrop-blur border-b border-line safe-top">
        <div className="px-3 py-2 flex items-center gap-3">
          <Link href={`/?album=${m.album.id}`} className="text-brand-deep text-lg px-1">‹ 返回</Link>
          <span className="text-sm text-muted ml-auto">{m.album.name}</span>
        </div>
      </header>

      <MediaStrip media={m.media} />

      <section className="px-4 py-3 space-y-2">
        <div className="text-sm text-muted">
          {fmtDate(m.taken_on)}
          {age ? ` · ${age}` : ''}
          {m.author_name ? ` · ${m.author_name}` : ''}
        </div>
        {m.caption && <p className="whitespace-pre-wrap leading-relaxed text-[16px]">{m.caption}</p>}
      </section>

      <section className="px-4 flex gap-2 flex-wrap">
        <form action={toggleLike}>
          <input type="hidden" name="id" value={m.id} />
          <button className={`px-4 py-2 rounded-full border text-sm ${liked ? 'bg-brand-soft border-brand text-brand-deep' : 'border-line bg-card'}`}>
            {liked ? '❤️' : '🤍'} {m.likedBy.length > 0 ? m.likedBy.length : '讚'}
          </button>
        </form>
        <form action={shareToLine}>
          <input type="hidden" name="id" value={m.id} />
          <button className="px-4 py-2 rounded-full border border-line bg-card text-sm">💬 分享到 LINE</button>
        </form>
        {canEdit && (
          <Link href={`/m/${m.id}/edit`} className="px-4 py-2 rounded-full border border-line bg-card text-sm">✏️ 編輯</Link>
        )}
        {canEdit && <DeleteButton id={m.id} action={deleteMoment} />}
      </section>
      {m.likedBy.length > 0 && (
        <p className="px-4 pt-2 text-xs text-muted">{m.likedBy.map((l) => l.name).join('、')} 說讚</p>
      )}

      <section className="px-4 pt-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted">留言 {m.comments.length > 0 ? m.comments.length : ''}</h2>
        {m.comments.map((c) => (
          <div key={c.id} className="bg-card border border-line rounded-xl px-3 py-2">
            <div className="text-xs text-muted flex gap-2">
              <span>{c.author_name ?? '家人'}</span>
              <span>{new Date(c.created_at).toLocaleDateString('zh-TW')}</span>
              {(member.role === 'admin' || c.member_id === member.id) && (
                <form action={deleteComment} className="ml-auto">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="commentId" value={c.id} />
                  <button className="text-muted">刪除</button>
                </form>
              )}
            </div>
            <p className="whitespace-pre-wrap text-[15px]">{c.body}</p>
          </div>
        ))}
        <form action={addComment} className="flex gap-2">
          <input type="hidden" name="id" value={m.id} />
          <input name="body" required maxLength={1000} placeholder="寫點什麼…" className="flex-1 rounded-full border border-line bg-card px-4 py-2 text-[16px]" />
          <button className="px-4 py-2 rounded-full bg-brand text-white text-sm">送出</button>
        </form>
      </section>
    </main>
  )
}
