import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

// 健康檢查:看正式站的設定對不對、連不連得到資料庫。
// 絕對不能把鑰匙印出來:錯誤訊息一律先遮掉長得像鑰匙的字串,而且只回短短一段。
const KEYISH = /(eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_(secret|publishable)_[\w-]+)/g

function redact(msg: string, key: string) {
  let out = msg
  if (key) out = out.split(key).join('[鑰匙]')
  out = out.replace(KEYISH, '[鑰匙]')
  return out.slice(0, 160)
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const trimmed = key.trim()
  const pastedTimes = (key.match(KEYISH) ?? []).length
  let keyRole = key ? 'unknown' : 'missing'
  if (pastedTimes > 1) keyRole = `貼了 ${pastedTimes} 次(要只貼一次)`
  else if (trimmed.startsWith('sb_secret_')) keyRole = 'secret'
  else if (trimmed.startsWith('sb_publishable_')) keyRole = 'publishable(錯的那把)'
  else if (trimmed.split('.').length === 3) {
    try {
      keyRole = JSON.parse(Buffer.from(trimmed.split('.')[1], 'base64url').toString()).role ?? 'unknown'
    } catch { keyRole = 'not-readable' }
  }
  let db = 'skipped'
  if (url && key && pastedTimes <= 1) {
    try {
      const { error } = await createAdminClient().from('albums').select('id', { head: true, count: 'exact' })
      db = error ? `error: ${redact(error.message, key)}` : 'ok'
    } catch (e) {
      db = `error: ${redact(e instanceof Error ? e.message : String(e), key)}`
    }
  }
  return NextResponse.json(
    { url: url ? new URL(url).host : 'missing', keyRole, keyHasSpaces: key !== trimmed, db },
    { headers: { 'cache-control': 'no-store' } },
  )
}
