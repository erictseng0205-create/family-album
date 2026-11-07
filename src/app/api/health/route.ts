import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

// 健康檢查:看正式站的設定對不對、連不連得到資料庫。不會露出鑰匙本身。
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  let keyRole = key ? 'unknown' : 'missing'
  if (key.startsWith('sb_secret_')) keyRole = 'secret'
  else if (key.startsWith('sb_publishable_')) keyRole = 'publishable(錯的那把)'
  else if (key.split('.').length === 3) {
    try {
      keyRole = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role ?? 'unknown'
    } catch { keyRole = 'not-readable' }
  }
  let db = 'skipped'
  if (url && key) {
    try {
      const { error } = await createAdminClient().from('albums').select('id', { head: true, count: 'exact' })
      db = error ? `error: ${error.message}` : 'ok'
    } catch (e) {
      db = `error: ${e instanceof Error ? e.message : String(e)}`
    }
  }
  return NextResponse.json(
    {
      url: url ? new URL(url).host : 'missing',
      keyRole,
      keyHasSpaces: key !== key.trim(),
      db,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
