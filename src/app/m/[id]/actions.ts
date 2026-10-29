'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireMember, newToken } from '@/lib/auth'
import { appUrl, BUCKET } from '@/lib/config'

async function loadMomentForMember(id: string) {
  const member = await requireMember()
  const sb = createAdminClient()
  const { data } = await sb.from('moments').select('id, author_id, albums(visibility)').eq('id', id).maybeSingle()
  const m = data as unknown as { id: string; author_id: string | null; albums: { visibility: string } } | null
  if (!m) redirect('/')
  if (m.albums.visibility === 'admins' && member.role !== 'admin') redirect('/')
  return { member, m, sb }
}

export async function toggleLike(form: FormData) {
  const id = String(form.get('id'))
  const { member, sb } = await loadMomentForMember(id)
  const { data } = await sb.from('likes').select('moment_id').eq('moment_id', id).eq('member_id', member.id).maybeSingle()
  if (data) await sb.from('likes').delete().eq('moment_id', id).eq('member_id', member.id)
  else await sb.from('likes').insert({ moment_id: id, member_id: member.id })
  revalidatePath(`/m/${id}`)
}

export async function addComment(form: FormData) {
  const id = String(form.get('id'))
  const body = String(form.get('body') ?? '').trim().slice(0, 1000)
  if (!body) return
  const { member, sb } = await loadMomentForMember(id)
  await sb.from('comments').insert({ moment_id: id, member_id: member.id, body })
  revalidatePath(`/m/${id}`)
}

export async function deleteComment(form: FormData) {
  const id = String(form.get('id'))
  const commentId = String(form.get('commentId'))
  const { member, sb } = await loadMomentForMember(id)
  const { data: c } = await sb.from('comments').select('member_id').eq('id', commentId).maybeSingle()
  if (!c) return
  if (member.role !== 'admin' && c.member_id !== member.id) return
  await sb.from('comments').delete().eq('id', commentId)
  revalidatePath(`/m/${id}`)
}

// 分享到 LINE:做一個 30 天的連結,直接跳到 LINE 的分享畫面
export async function shareToLine(form: FormData) {
  const id = String(form.get('id'))
  const { member, sb } = await loadMomentForMember(id)
  const token = newToken(16)
  const { error } = await sb.from('share_links').insert({ token, moment_id: id, created_by: member.id })
  if (error) throw new Error(error.message)
  const url = `${appUrl()}/s/${token}`
  redirect(`https://line.me/R/share?text=${encodeURIComponent(url)}`)
}

export async function deleteMoment(form: FormData) {
  const id = String(form.get('id'))
  const { member, m, sb } = await loadMomentForMember(id)
  if (member.role !== 'admin' && m.author_id !== member.id) redirect(`/m/${id}`)
  const { data: files } = await sb.from('media').select('storage_path, thumb_path').eq('moment_id', id)
  const paths = (files ?? []).flatMap((f) => [f.storage_path, f.thumb_path]).filter((p): p is string => !!p)
  if (paths.length) await sb.storage.from(BUCKET).remove(paths)
  await sb.from('moments').delete().eq('id', id)
  revalidatePath('/')
  redirect('/')
}

export async function updateMoment(form: FormData) {
  const id = String(form.get('id'))
  const { member, m, sb } = await loadMomentForMember(id)
  if (member.role !== 'admin' && m.author_id !== member.id) redirect(`/m/${id}`)
  const takenOn = String(form.get('taken_on') ?? '')
  const caption = String(form.get('caption') ?? '').trim().slice(0, 2000)
  const albumId = String(form.get('album_id') ?? '')
  const patch: Record<string, string> = { caption }
  if (/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) patch.taken_on = takenOn
  if (albumId) {
    const { data: a } = await sb.from('albums').select('id, visibility').eq('id', albumId).maybeSingle()
    if (a && (a.visibility === 'family' || member.role === 'admin')) patch.album_id = a.id
  }
  await sb.from('moments').update(patch).eq('id', id)
  revalidatePath('/')
  redirect(`/m/${id}`)
}
