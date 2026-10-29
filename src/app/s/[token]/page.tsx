import { createAdminClient } from '@/lib/supabase-admin'
import { getMoment } from '@/lib/db'
import { ageLabel, fmtDate } from '@/lib/age'
import { APP_NAME } from '@/lib/config'
import MediaStrip from '@/components/media-strip'

export const dynamic = 'force-dynamic'

// 分享到 LINE 的那一則:不用登入,30 天內看得到
export default async function Shared({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const sb = createAdminClient()
  const { data: link } = await sb.from('share_links').select('moment_id, expires_at').eq('token', token).maybeSingle()
  const ok = link && new Date(link.expires_at).getTime() > Date.now()
  const m = ok ? await getMoment(link.moment_id, { id: '', name: '', role: 'admin' }) : null
  if (!m) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6 text-center text-muted">這個分享連結已經失效了。</main>
    )
  }
  const age = ageLabel(m.album.birthday, m.taken_on)
  return (
    <main className="min-h-dvh max-w-xl mx-auto">
      <header className="px-4 py-3 flex items-center justify-between border-b border-line">
        <span className="font-bold text-brand-deep">{APP_NAME}</span>
        <span className="text-sm text-muted">{m.album.name}</span>
      </header>
      <MediaStrip media={m.media} />
      <section className="px-4 py-3 space-y-2">
        <div className="text-sm text-muted">{fmtDate(m.taken_on)}{age ? ` · ${age}` : ''}</div>
        {m.caption && <p className="whitespace-pre-wrap leading-relaxed">{m.caption}</p>}
      </section>
    </main>
  )
}
