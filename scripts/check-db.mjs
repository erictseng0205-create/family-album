// 看資料庫建好了沒、檔案桶和上傳上限
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: albums, error } = await sb.from('albums').select('slug, name, visibility')
console.log('albums:', error ? 'ERROR ' + error.message : JSON.stringify(albums))
const { data: inv, error: e2 } = await sb.from('invites').select('name, role, expires_at')
console.log('invites:', e2 ? 'ERROR ' + e2.message : JSON.stringify(inv))
const { data: buckets, error: e3 } = await sb.storage.listBuckets()
console.log('buckets:', e3 ? 'ERROR ' + e3.message : JSON.stringify(buckets?.map((b) => ({ name: b.name, public: b.public, limit: b.file_size_limit }))))
const { count } = await sb.from('moments').select('id', { count: 'exact', head: true })
console.log('moments:', count)
