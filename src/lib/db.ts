import 'server-only'
import { createAdminClient } from './supabase-admin'
import { signUrls } from './media'
import { PAGE_SIZE } from './config'
import type { Member } from './auth'

export type Album = {
  id: string
  slug: string
  name: string
  birthday: string | null
  visibility: 'family' | 'admins'
  sort: number
}

export type MediaItem = {
  id: string
  kind: 'photo' | 'video'
  storage_path: string
  thumb_path: string | null
  width: number | null
  height: number | null
  duration_sec: number | null
  sort: number
  url?: string
  thumbUrl?: string
}

export type MomentCard = {
  id: string
  album_id: string
  taken_on: string
  caption: string
  author_name: string | null
  created_at: string
  media: MediaItem[]
  like_count: number
  comment_count: number
}

// 這個人看得到哪些相簿
export async function visibleAlbums(member: Member): Promise<Album[]> {
  const sb = createAdminClient()
  let q = sb.from('albums').select('id, slug, name, birthday, visibility, sort').order('sort').order('created_at')
  if (member.role !== 'admin') q = q.eq('visibility', 'family')
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as Album[]
}

export type Cursor = { takenOn: string; createdAt: string } | null

export function parseCursor(s: string | undefined | null): Cursor {
  if (!s) return null
  const i = s.indexOf('|')
  if (i < 0) return null
  return { takenOn: s.slice(0, i), createdAt: s.slice(i + 1) }
}

export function cursorOf(m: MomentCard) {
  return `${m.taken_on}|${m.created_at}`
}

// 時間軸:某幾本相簿、從某個點往更早拿一頁
export async function listMoments(albumIds: string[], cursor: Cursor): Promise<{ items: MomentCard[]; next: string | null }> {
  if (albumIds.length === 0) return { items: [], next: null }
  const sb = createAdminClient()
  let q = sb
    .from('moments')
    .select('id, album_id, taken_on, caption, author_name, created_at, members!moments_author_id_fkey(name), media(id, kind, storage_path, thumb_path, width, height, duration_sec, sort), likes(count), comments(count)')
    .in('album_id', albumIds)
    .order('taken_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1)
  if (cursor) {
    q = q.or(`taken_on.lt.${cursor.takenOn},and(taken_on.eq.${cursor.takenOn},created_at.lt.${cursor.createdAt})`)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as Array<{
    id: string; album_id: string; taken_on: string; caption: string; author_name: string | null; created_at: string
    members: { name: string } | null
    media: MediaItem[]
    likes: Array<{ count: number }>
    comments: Array<{ count: number }>
  }>
  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)
  const items: MomentCard[] = page.map((r) => ({
    id: r.id,
    album_id: r.album_id,
    taken_on: r.taken_on,
    caption: r.caption,
    author_name: r.members?.name ?? r.author_name,
    created_at: r.created_at,
    media: [...(r.media ?? [])].sort((a, b) => a.sort - b.sort),
    like_count: r.likes?.[0]?.count ?? 0,
    comment_count: r.comments?.[0]?.count ?? 0,
  }))
  await attachUrls(items, 'thumb')
  const last = items[items.length - 1]
  return { items, next: hasMore && last ? cursorOf(last) : null }
}

// 把看圖網址掛上去:時間軸只要縮圖,詳細頁要原檔
export async function attachUrls(items: MomentCard[], mode: 'thumb' | 'full') {
  const paths: string[] = []
  for (const m of items) for (const f of m.media) {
    paths.push(f.thumb_path ?? f.storage_path)
    if (mode === 'full') paths.push(f.storage_path)
  }
  const urls = await signUrls(paths)
  for (const m of items) for (const f of m.media) {
    f.thumbUrl = urls[f.thumb_path ?? f.storage_path]
    if (mode === 'full') f.url = urls[f.storage_path]
  }
}

export type Comment = { id: string; body: string; created_at: string; author_name: string | null; member_id: string | null }

export async function getMoment(id: string, member: Member | null) {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('moments')
    .select('id, album_id, taken_on, caption, author_id, author_name, created_at, members!moments_author_id_fkey(name), albums(id, name, birthday, visibility), media(id, kind, storage_path, thumb_path, width, height, duration_sec, sort), likes(member_id, members(name)), comments(id, body, created_at, member_id, author_name, members(name))')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const r = data as unknown as {
    id: string; album_id: string; taken_on: string; caption: string; author_id: string | null; author_name: string | null; created_at: string
    members: { name: string } | null
    albums: Album
    media: MediaItem[]
    likes: Array<{ member_id: string; members: { name: string } | null }>
    comments: Array<{ id: string; body: string; created_at: string; member_id: string | null; author_name: string | null; members: { name: string } | null }>
  }
  if (r.albums.visibility === 'admins' && member?.role !== 'admin') return null
  const card: MomentCard = {
    id: r.id,
    album_id: r.album_id,
    taken_on: r.taken_on,
    caption: r.caption,
    author_name: r.members?.name ?? r.author_name,
    created_at: r.created_at,
    media: [...(r.media ?? [])].sort((a, b) => a.sort - b.sort),
    like_count: r.likes?.length ?? 0,
    comment_count: r.comments?.length ?? 0,
  }
  await attachUrls([card], 'full')
  const comments: Comment[] = [...(r.comments ?? [])]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, member_id: c.member_id, author_name: c.members?.name ?? c.author_name }))
  return {
    ...card,
    author_id: r.author_id,
    album: r.albums,
    likedBy: (r.likes ?? []).map((l) => ({ member_id: l.member_id, name: l.members?.name ?? '' })),
    comments,
  }
}
