import { NextResponse } from 'next/server'
import { getMember } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { listMoments, parseCursor, visibleAlbums } from '@/lib/db'

// 時間軸往下滑:拿更早的一頁
export async function GET(req: Request) {
  const member = await getMember()
  if (!member) return new NextResponse('unauthorized', { status: 401 })
  const url = new URL(req.url)
  const allowed = new Set((await visibleAlbums(member)).map((a) => a.id))
  const ids = (url.searchParams.get('album') ?? '').split(',').filter((id) => allowed.has(id))
  const page = await listMoments(ids, parseCursor(url.searchParams.get('before')))
  return NextResponse.json(page)
}

type MediaIn = { path: string; thumbPath: string | null; kind: 'photo' | 'video'; width: number | null; height: number | null; duration: number | null; bytes: number | null; takenAt: string | null }

// 上傳最後一步:檔案都丟上去了,把這一則寫進資料庫
export async function POST(req: Request) {
  const member = await getMember()
  if (!member) return new NextResponse('unauthorized', { status: 401 })
  const body = (await req.json()) as { momentId: string; albumId: string; takenOn: string; caption: string; media: MediaIn[] }
  if (!body?.momentId || !body.albumId || !/^\d{4}-\d{2}-\d{2}$/.test(body.takenOn ?? '') || !Array.isArray(body.media) || body.media.length === 0) {
    return new NextResponse('bad request', { status: 400 })
  }
  const sb = createAdminClient()
  const { data: album } = await sb.from('albums').select('id, visibility').eq('id', body.albumId).maybeSingle()
  if (!album || (album.visibility === 'admins' && member.role !== 'admin')) return new NextResponse('forbidden', { status: 403 })

  const prefix = `${album.id}/${body.momentId}/`
  for (const m of body.media) {
    if (!m.path.startsWith(prefix) || (m.thumbPath && !m.thumbPath.startsWith(prefix))) return new NextResponse('bad path', { status: 400 })
  }
  const { error: e1 } = await sb.from('moments').insert({
    id: body.momentId,
    album_id: album.id,
    taken_on: body.takenOn,
    caption: String(body.caption ?? '').trim().slice(0, 2000),
    author_id: member.id,
    source: 'upload',
  })
  if (e1) return new NextResponse(e1.message, { status: 500 })
  const { error: e2 } = await sb.from('media').insert(
    body.media.map((m, i) => ({
      moment_id: body.momentId,
      kind: m.kind === 'video' ? 'video' : 'photo',
      storage_path: m.path,
      thumb_path: m.thumbPath,
      width: m.width,
      height: m.height,
      duration_sec: m.duration,
      bytes: m.bytes,
      taken_at: m.takenAt,
      sort: i,
    })),
  )
  if (e2) return new NextResponse(e2.message, { status: 500 })
  return NextResponse.json({ ok: true })
}
