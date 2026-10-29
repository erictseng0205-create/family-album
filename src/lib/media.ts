import 'server-only'
import { createAdminClient } from './supabase-admin'
import { BUCKET } from './config'

// 一次把一批檔案路徑換成可以看的網址(1 小時有效)
export async function signUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (unique.length === 0) return {}
  const sb = createAdminClient()
  const out: Record<string, string> = {}
  // Supabase 一次最多簽幾百個;分批
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100)
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(chunk, 3600)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) out[row.path] = row.signedUrl
    }
  }
  return out
}
