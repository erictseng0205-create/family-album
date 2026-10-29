// 把抓下來的時光小屋資料搬進新 App(Supabase)
// 用法:node scripts/timehut-import.mjs <compact.json> <抓檔資料夾>   (會讀 .env.local)
// 可以重跑:已經搬過的事件(source_id 相同)會跳過
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const [,, jsonPath, dataDir] = process.argv
if (!jsonPath || !dataDir) { console.error('用法:node scripts/timehut-import.mjs <compact.json> <抓檔資料夾>'); process.exit(1) }

// 讀 .env.local
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const BUCKET = 'media'
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
const REL = { dad: '爸爸', mom: '媽媽', grandma: '阿嬤', grandpa: '阿公' }
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime' }

// 台灣日期
function taipeiDate(epochSec) {
  const d = new Date(epochSec * 1000 + 8 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}

// 1. 相簿:一個小孩一本
const albumByBaby = {}
const babies = Object.values(data.babies).sort((a, b) => a.birthday.localeCompare(b.birthday))
for (let i = 0; i < babies.length; i++) {
  const b = babies[i]
  const { data: existing } = await sb.from('albums').select('id').eq('timehut_baby_id', b.id).maybeSingle()
  if (existing) { albumByBaby[b.id] = existing.id; continue }
  const { data: row, error } = await sb.from('albums').insert({ slug: `baby-${b.id}`, name: b.name, birthday: b.birthday, visibility: 'family', sort: i + 1, timehut_baby_id: b.id }).select('id').single()
  if (error) throw new Error(error.message)
  albumByBaby[b.id] = row.id
  console.log('建相簿', b.name, b.birthday)
}

// 2. 已經搬過的事件
const { data: doneRows } = await sb.from('moments').select('source_id').eq('source', 'timehut')
const done = new Set((doneRows ?? []).map((r) => r.source_id))

async function upload(storagePath, buf, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(storagePath, buf, { contentType, upsert: true })
  if (error) throw new Error(`${storagePath}: ${error.message}`)
}

// HEIC 瀏覽器不會顯示:用 Mac 內建的 sips 轉成 JPEG
function heicToJpeg(file) {
  const out = file.replace(/\.heic$/i, '.jpg')
  if (!fs.existsSync(out)) execFileSync('sips', ['-s', 'format', 'jpeg', file, '--out', out], { stdio: 'ignore' })
  return out
}

let imported = 0, skipped = 0, failed = 0
const events = [...data.events].sort((a, b) => a[2] - b[2])
for (const e of events) {
  const [eventId, babyId, takenAt, layout, caption, media, comments] = e
  if (done.has(eventId)) { skipped++; continue }
  const baby = data.babies[String(babyId)]
  const files = media.filter((m) => m[2] >= 0 && m[3])
  const texts = media.filter((m) => m[9]).map((m) => m[9])
  const fullCaption = [caption, ...texts].filter(Boolean).join('\n').trim()
  if (files.length === 0 && !fullCaption) { skipped++; continue }   // 自動產生的空里程碑

  const momentId = randomUUID()
  const albumId = albumByBaby[babyId]
  const authorRel = (files[0] ?? media[0])?.[10] ?? ''
  const authorName = REL[authorRel] ?? authorRel ?? null
  try {
    const rows = []
    for (let i = 0; i < files.length; i++) {
      const [id, type, , file, w, h, dur, mTaken] = files[i]
      const ext = (path.extname(file) || (type === 'v' ? '.mp4' : '.jpg')).toLowerCase()
      let local = path.join(dataDir, 'files', baby.name, eventId, id + ext)
      if (!fs.existsSync(local)) throw new Error('缺檔 ' + local)
      let useExt = ext
      if (ext === '.heic') { local = heicToJpeg(local); useExt = '.jpg' }
      const mediaId = randomUUID()
      const storagePath = `${albumId}/${momentId}/${mediaId}${useExt}`
      const thumbPath = `${albumId}/${momentId}/${mediaId}_t.jpg`
      const buf = fs.readFileSync(local)
      await upload(storagePath, buf, MIME[useExt.slice(1)] ?? 'application/octet-stream')
      // 縮圖:照片直接縮;影片用抓下來的封面縮
      let thumbSrc = type === 'v' ? path.join(dataDir, 'files', baby.name, eventId, id + '_poster.jpg') : local
      let hasThumb = false
      if (fs.existsSync(thumbSrc)) {
        try {
          const t = await sharp(thumbSrc).rotate().resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
          await upload(thumbPath, t, 'image/jpeg')
          hasThumb = true
        } catch (err) { console.warn('縮圖失敗', id, String(err)) }
      }
      rows.push({
        moment_id: momentId, kind: type === 'v' ? 'video' : 'photo', storage_path: storagePath, thumb_path: hasThumb ? thumbPath : null,
        width: w || null, height: h || null, duration_sec: dur || null, bytes: buf.length,
        taken_at: mTaken ? new Date(mTaken * 1000).toISOString() : null, sort: i, source_id: id,
      })
    }
    const { error: e1 } = await sb.from('moments').insert({
      id: momentId, album_id: albumId, taken_on: taipeiDate(takenAt), caption: fullCaption, author_name: authorName,
      source: 'timehut', source_id: eventId, created_at: new Date(takenAt * 1000).toISOString(),
    })
    if (e1) throw new Error(e1.message)
    if (rows.length) {
      const { error: e2 } = await sb.from('media').insert(rows)
      if (e2) throw new Error(e2.message)
    }
    if (comments.length) {
      await sb.from('comments').insert(comments.map(([name, body, at]) => ({ moment_id: momentId, author_name: name, body: body || '', created_at: at })))
    }
    imported++
    if (imported % 25 === 0) console.log(`已搬 ${imported}(跳過 ${skipped}、失敗 ${failed})`)
  } catch (err) {
    failed++
    console.error('失敗', eventId, layout, String(err))
    await sb.from('moments').delete().eq('id', momentId)
  }
}
console.log(`完成:搬了 ${imported}、跳過 ${skipped}、失敗 ${failed}`)
