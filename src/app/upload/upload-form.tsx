'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import exifr from 'exifr'

type Picked = {
  key: string
  file: File
  kind: 'photo' | 'video'
  preview: string
  width?: number
  height?: number
  duration?: number
  takenAt?: Date
  thumb?: Blob
  pct: number
  status: 'wait' | 'up' | 'done' | 'err'
}

function toLocalDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// 照片縮圖:長邊 900,JPEG
async function makePhotoThumb(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file)
  const max = 900
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
  if (!blob) throw new Error('thumb failed')
  return { blob, width: bmp.width, height: bmp.height }
}

// 影片縮圖:抓第 0.5 秒那一格
function makeVideoThumb(file: File): Promise<{ blob?: Blob; width: number; height: number; duration: number }> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.playsInline = true
    const url = URL.createObjectURL(file)
    let settled = false
    const finish = (blob?: Blob) => {
      if (settled) return
      settled = true
      const out = { blob, width: v.videoWidth, height: v.videoHeight, duration: v.duration }
      URL.revokeObjectURL(url)
      resolve(out)
    }
    v.onerror = () => finish()
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2) }
    v.onseeked = () => {
      try {
        const max = 900
        const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(v.videoWidth * scale)
        canvas.height = Math.round(v.videoHeight * scale)
        canvas.getContext('2d')!.drawImage(v, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((b) => finish(b ?? undefined), 'image/jpeg', 0.82)
      } catch { finish() }
    }
    setTimeout(() => finish(), 8000)
    v.src = url
  })
}

function putWithProgress(url: string, body: Blob, contentType: string, onPct: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', contentType || 'application/octet-stream')
    xhr.setRequestHeader('cache-control', 'max-age=31536000')
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}: ${xhr.responseText.slice(0, 200)}`)))
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(body)
  })
}

export default function UploadForm({ albums, defaultAlbum }: { albums: { id: string; name: string }[]; defaultAlbum: string }) {
  const router = useRouter()
  const [albumId, setAlbumId] = useState(defaultAlbum)
  const [date, setDate] = useState(toLocalDate(new Date()))
  const [caption, setCaption] = useState('')
  const [items, setItems] = useState<Picked[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return
    setError('')
    const picked: Picked[] = []
    for (const file of Array.from(files)) {
      const kind: Picked['kind'] = file.type.startsWith('video/') ? 'video' : 'photo'
      const p: Picked = { key: `${file.name}-${file.size}-${file.lastModified}`, file, kind, preview: URL.createObjectURL(file), pct: 0, status: 'wait' }
      try {
        if (kind === 'photo') {
          const t = await makePhotoThumb(file)
          p.thumb = t.blob; p.width = t.width; p.height = t.height
          try {
            const ex = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate'])
            const d = ex?.DateTimeOriginal ?? ex?.CreateDate
            if (d instanceof Date && !isNaN(d.getTime())) p.takenAt = d
          } catch { /* 沒有拍照時間就用檔案時間 */ }
        } else {
          const t = await makeVideoThumb(file)
          p.thumb = t.blob; p.width = t.width; p.height = t.height; p.duration = t.duration
        }
      } catch { /* 縮圖失敗也能傳 */ }
      if (!p.takenAt) p.takenAt = new Date(file.lastModified)
      picked.push(p)
    }
    setItems((prev) => {
      const next = [...prev, ...picked.filter((p) => !prev.some((q) => q.key === p.key))]
      const earliest = next.map((p) => p.takenAt!).sort((a, b) => a.getTime() - b.getTime())[0]
      if (earliest && prev.length === 0) setDate(toLocalDate(earliest))
      return next
    })
  }

  function remove(key: string) {
    setItems((prev) => prev.filter((p) => p.key !== key))
  }

  async function submit() {
    if (items.length === 0 || busy) return
    setBusy(true)
    setError('')
    try {
      const signRes = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ albumId, files: items.map((p) => ({ name: p.file.name, type: p.file.type, size: p.file.size, kind: p.kind, hasThumb: !!p.thumb })) }),
      })
      if (!signRes.ok) throw new Error(await signRes.text())
      const sign = (await signRes.json()) as { momentId: string; items: { path: string; signedUrl: string; thumbPath: string | null; thumbSignedUrl: string | null }[] }

      const media: Array<Record<string, unknown>> = []
      for (let i = 0; i < items.length; i++) {
        const p = items[i]
        const s = sign.items[i]
        setItems((prev) => prev.map((q) => (q.key === p.key ? { ...q, status: 'up' } : q)))
        await putWithProgress(s.signedUrl, p.file, p.file.type, (pct) => setItems((prev) => prev.map((q) => (q.key === p.key ? { ...q, pct } : q))))
        if (p.thumb && s.thumbSignedUrl) await putWithProgress(s.thumbSignedUrl, p.thumb, 'image/jpeg', () => {})
        setItems((prev) => prev.map((q) => (q.key === p.key ? { ...q, status: 'done', pct: 100 } : q)))
        media.push({
          path: s.path,
          thumbPath: p.thumb && s.thumbPath ? s.thumbPath : null,
          kind: p.kind,
          width: p.width ?? null,
          height: p.height ?? null,
          duration: p.duration ?? null,
          bytes: p.file.size,
          takenAt: p.takenAt?.toISOString() ?? null,
        })
      }
      const done = await fetch('/api/moments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ momentId: sign.momentId, albumId, takenOn: date, caption, media }),
      })
      if (!done.ok) throw new Error(await done.text())
      router.push(`/m/${sign.momentId}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { void onPick(e.target.files); e.target.value = '' }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        className="w-full py-6 rounded-2xl border-2 border-dashed border-brand bg-brand-soft text-brand-deep font-semibold text-lg">
        ＋ 從相簿選照片 / 影片
      </button>

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {items.map((p) => (
            <div key={p.key} className="relative aspect-square bg-line rounded-lg overflow-hidden">
              {p.kind === 'video' ? (
                <video src={p.preview} muted playsInline className="w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.preview} alt="" className="w-full h-full object-cover" />
              )}
              {p.kind === 'video' && <span className="absolute bottom-1 left-1 text-white text-xs bg-black/50 px-1 rounded">▶</span>}
              {!busy && (
                <button type="button" onClick={() => remove(p.key)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs">✕</button>
              )}
              {p.status !== 'wait' && (
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
                  <div className={`h-full ${p.status === 'done' ? 'bg-green-400' : 'bg-brand'}`} style={{ width: `${p.pct}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <label className="block">
        <span className="text-sm text-muted">相簿</span>
        <select value={albumId} onChange={(e) => setAlbumId(e.target.value)} disabled={busy} className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-[16px]">
          {albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-sm text-muted">日期(自動抓拍照時間,可以改)</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-[16px]" />
      </label>
      <label className="block">
        <span className="text-sm text-muted">說明</span>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} disabled={busy} rows={3} placeholder="今天發生了什麼…" className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-[16px]" />
      </label>

      {error && <p className="text-red-600 text-sm whitespace-pre-wrap">上傳失敗:{error}</p>}

      <button type="button" onClick={() => void submit()} disabled={busy || items.length === 0}
        className="w-full py-3 rounded-full bg-brand text-white font-semibold text-lg disabled:opacity-40">
        {busy ? '上傳中…請不要關閉' : `上傳 ${items.length > 0 ? items.length + ' 個' : ''}`}
      </button>
    </div>
  )
}
