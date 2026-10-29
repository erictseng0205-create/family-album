'use client'
import { useEffect, useRef, useState } from 'react'
import type { Album, MomentCard as MomentCardT } from '@/lib/db'
import MomentCard from './moment-card'
import { fmtDate } from '@/lib/age'

// 時間軸:先拿到第一頁,滑到底再自動拿更早的
export default function Timeline({
  initial,
  next,
  albums,
  albumParam,
  showAlbum,
}: {
  initial: MomentCardT[]
  next: string | null
  albums: Album[]
  albumParam: string
  showAlbum: boolean
}) {
  const [items, setItems] = useState(initial)
  const [cursor, setCursor] = useState(next)
  const [loading, setLoading] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const byId = Object.fromEntries(albums.map((a) => [a.id, a]))

  useEffect(() => {
    setItems(initial)
    setCursor(next)
  }, [initial, next])

  useEffect(() => {
    if (!cursor || !sentinel.current) return
    const el = sentinel.current
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loading) return
      setLoading(true)
      try {
        const r = await fetch(`/api/moments?album=${encodeURIComponent(albumParam)}&before=${encodeURIComponent(cursor)}`)
        if (r.ok) {
          const j = (await r.json()) as { items: MomentCardT[]; next: string | null }
          setItems((prev) => [...prev, ...j.items])
          setCursor(j.next)
        } else {
          setCursor(null)
        }
      } finally {
        setLoading(false)
      }
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [cursor, loading, albumParam])

  if (items.length === 0) {
    return (
      <div className="text-center text-muted py-20">
        <div className="text-5xl mb-3">📷</div>
        還沒有照片。按下面的「上傳」放第一張吧。
      </div>
    )
  }

  let lastDate = ''
  return (
    <div className="space-y-3">
      {items.map((m) => {
        const header = m.taken_on !== lastDate
        lastDate = m.taken_on
        const a = byId[m.album_id]
        return (
          <div key={m.id} className="space-y-3">
            {header && <h2 className="text-sm font-semibold text-brand-deep pt-2">{fmtDate(m.taken_on)}</h2>}
            <MomentCard m={m} albumName={a?.name} birthday={a?.birthday} showAlbum={showAlbum} />
          </div>
        )
      })}
      <div ref={sentinel} className="h-10 text-center text-muted text-sm">
        {loading ? '載入中…' : cursor ? '' : '— 已經是最早的了 —'}
      </div>
    </div>
  )
}
