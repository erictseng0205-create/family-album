import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { getMoment, visibleAlbums } from '@/lib/db'
import { updateMoment } from '../actions'

export const dynamic = 'force-dynamic'

export default async function EditMoment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const member = await requireMember()
  const m = await getMoment(id, member)
  if (!m) notFound()
  if (member.role !== 'admin' && m.author_id !== member.id) redirect(`/m/${id}`)
  const albums = await visibleAlbums(member)
  return (
    <main className="min-h-dvh max-w-xl mx-auto px-4 py-4 space-y-4">
      <Link href={`/m/${id}`} className="text-brand-deep">‹ 返回</Link>
      <h1 className="text-lg font-bold">編輯</h1>
      <form action={updateMoment} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <label className="block">
          <span className="text-sm text-muted">日期</span>
          <input type="date" name="taken_on" defaultValue={m.taken_on} className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-[16px]" />
        </label>
        <label className="block">
          <span className="text-sm text-muted">相簿</span>
          <select name="album_id" defaultValue={m.album_id} className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-[16px]">
            {albums.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-muted">說明</span>
          <textarea name="caption" defaultValue={m.caption} rows={5} className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-[16px]" />
        </label>
        <button className="w-full py-3 rounded-full bg-brand text-white font-semibold">儲存</button>
      </form>
    </main>
  )
}
