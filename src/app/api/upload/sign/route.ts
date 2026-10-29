import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getMember } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { BUCKET } from '@/lib/config'

const MAX_FILES = 60

function extOf(name: string, type: string) {
  const m = /\.([a-z0-9]{2,5})$/i.exec(name)
  if (m) return m[1].toLowerCase()
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/heic') return 'heic'
  if (type === 'video/mp4') return 'mp4'
  if (type === 'video/quicktime') return 'mov'
  return 'bin'
}

// 上傳第一步:先跟伺服器要「可以直接丟到 Storage 的網址」,檔案不經過 Vercel
export async function POST(req: Request) {
  const member = await getMember()
  if (!member) return new NextResponse('unauthorized', { status: 401 })
  const body = (await req.json()) as { albumId: string; files: { name: string; type: string; size: number; kind: 'photo' | 'video'; hasThumb: boolean }[] }
  if (!body?.albumId || !Array.isArray(body.files) || body.files.length === 0 || body.files.length > MAX_FILES) {
    return new NextResponse('bad request', { status: 400 })
  }
  const sb = createAdminClient()
  const { data: album } = await sb.from('albums').select('id, visibility').eq('id', body.albumId).maybeSingle()
  if (!album || (album.visibility === 'admins' && member.role !== 'admin')) return new NextResponse('forbidden', { status: 403 })

  const momentId = randomUUID()
  const items = []
  for (const f of body.files) {
    const mediaId = randomUUID()
    const path = `${album.id}/${momentId}/${mediaId}.${extOf(f.name, f.type)}`
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) return new NextResponse(error?.message ?? 'sign failed', { status: 500 })
    let thumbPath: string | null = null
    let thumbSignedUrl: string | null = null
    if (f.hasThumb) {
      thumbPath = `${album.id}/${momentId}/${mediaId}_t.jpg`
      const t = await sb.storage.from(BUCKET).createSignedUploadUrl(thumbPath)
      if (t.error || !t.data) return new NextResponse(t.error?.message ?? 'sign failed', { status: 500 })
      thumbSignedUrl = t.data.signedUrl
    }
    items.push({ path, signedUrl: data.signedUrl, thumbPath, thumbSignedUrl })
  }
  return NextResponse.json({ momentId, items })
}
