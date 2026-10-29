// 試傳一個最大的檔,看 Storage 上傳上限夠不夠;傳完就刪
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const root = process.argv[2]
let biggest = null
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p); if (s.isDirectory()) walk(p); else if (p.endsWith('.mp4') && (!biggest || s.size > biggest.size)) biggest = { p, size: s.size } } }
walk(root)
console.log('最大檔', biggest.p, (biggest.size / 1e6).toFixed(0), 'MB')
const t0 = Date.now()
const { error } = await sb.storage.from('media').upload('_test/big.mp4', fs.readFileSync(biggest.p), { contentType: 'video/mp4', upsert: true })
console.log(error ? 'FAILED: ' + error.message : `OK,花 ${((Date.now() - t0) / 1000).toFixed(0)} 秒`)
if (!error) await sb.storage.from('media').remove(['_test/big.mp4'])
