// 把時光小屋的照片/影片全部抓到本機
// 用法:node scripts/timehut-download.mjs <compact.json> <輸出資料夾>
// 會做:files/<小孩>/<事件id>/<時光id>.jpg|mp4,影片另抓一張封面 <時光id>_poster.jpg
// 可以重跑:已經抓好的會跳過
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const [,, jsonPath, outDir] = process.argv
if (!jsonPath || !outDir) { console.error('用法:node scripts/timehut-download.mjs <compact.json> <輸出資料夾>'); process.exit(1) }
const HOST = 'https://aehk.peekaboocdn.com/'   // 這個主機不用簽名就能抓原檔
const POSTER = '?x-oss-process=video/snapshot,t_0,f_jpg,m_fast,ar_auto'
const CONCURRENCY = 8

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
const babyName = Object.fromEntries(Object.values(data.babies).map((b) => [String(b.id), b.name]))
const jobs = []
for (const e of data.events) {
  const [eventId, babyId, , , , media] = e
  const baby = babyName[String(babyId)] ?? String(babyId)
  for (const m of media) {
    const [id, type, dirIdx, file] = m
    if (dirIdx < 0 || !file) continue
    const url = HOST + data.dirs[dirIdx] + '/' + file
    const ext = (path.extname(file) || (type === 'v' ? '.mp4' : '.jpg')).toLowerCase()
    const dest = path.join(outDir, 'files', baby, eventId, id + ext)
    jobs.push({ url, dest, bytes: m[8] || 0, kind: type })
    if (type === 'v') jobs.push({ url: url + POSTER, dest: path.join(outDir, 'files', baby, eventId, id + '_poster.jpg'), bytes: 0, kind: 'poster' })
  }
}
const logPath = path.join(outDir, 'download-log.txt')
const log = (s) => { const line = `${new Date().toISOString()} ${s}`; console.log(line); fs.appendFileSync(logPath, line + '\n') }
log(`共 ${jobs.length} 個檔案要抓`)

let done = 0, skipped = 0, failed = []
let next = 0
async function one(job) {
  if (fs.existsSync(job.dest)) {
    const sz = fs.statSync(job.dest).size
    if (sz > 0 && (job.bytes === 0 || sz === job.bytes)) { skipped++; return }
  }
  fs.mkdirSync(path.dirname(job.dest), { recursive: true })
  const tmp = job.dest + '.part'
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(job.url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!r.ok || !r.body) throw new Error('HTTP ' + r.status)
      await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(tmp))
      const sz = fs.statSync(tmp).size
      if (sz === 0) throw new Error('empty')
      fs.renameSync(tmp, job.dest)
      done++
      return
    } catch (err) {
      try { fs.unlinkSync(tmp) } catch {}
      if (attempt === 4) { failed.push({ ...job, err: String(err) }); log(`失敗 ${job.url} ${err}`) }
      else await new Promise((res) => setTimeout(res, 1500 * attempt))
    }
  }
}
async function worker() {
  while (next < jobs.length) {
    const j = jobs[next++]
    await one(j)
    const n = done + skipped + failed.length
    if (n % 200 === 0) log(`進度 ${n}/${jobs.length}(新抓 ${done}、已有 ${skipped}、失敗 ${failed.length})`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
log(`完成:新抓 ${done}、已有 ${skipped}、失敗 ${failed.length}`)
fs.writeFileSync(path.join(outDir, 'download-result.json'), JSON.stringify({ total: jobs.length, done, skipped, failed }, null, 2))
