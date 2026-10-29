import Link from 'next/link'
import type { MomentCard as MomentCardT, MediaItem } from '@/lib/db'
import { ageLabel, fmtDuration } from '@/lib/age'

// 時間軸上的一則:說明 + 照片格子;整張可以點進去看
export default function MomentCard({
  m,
  albumName,
  birthday,
  showAlbum,
}: {
  m: MomentCardT
  albumName?: string
  birthday?: string | null
  showAlbum: boolean
}) {
  const age = ageLabel(birthday, m.taken_on)
  return (
    <Link href={`/m/${m.id}`} className="block bg-card rounded-2xl border border-line overflow-hidden active:opacity-80">
      {(showAlbum || age) && (
        <div className="px-3 pt-2 flex gap-2 text-xs text-muted">
          {showAlbum && albumName && <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand-deep">{albumName}</span>}
          {age && <span className="py-0.5">{age}</span>}
        </div>
      )}
      {m.caption && <p className="px-3 pt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{m.caption}</p>}
      <MediaGrid media={m.media} />
      <div className="px-3 py-2 flex gap-3 text-xs text-muted">
        {m.like_count > 0 && <span>❤️ {m.like_count}</span>}
        {m.comment_count > 0 && <span>💬 {m.comment_count}</span>}
        {m.author_name && <span className="ml-auto">{m.author_name}</span>}
      </div>
    </Link>
  )
}

function MediaGrid({ media }: { media: MediaItem[] }) {
  if (media.length === 0) return null
  if (media.length === 1) {
    const f = media[0]
    const ratio = f.width && f.height ? Math.max(0.6, Math.min(1.6, f.width / f.height)) : 1
    return (
      <div className="relative mt-2 bg-line" style={{ aspectRatio: String(ratio) }}>
        <Thumb f={f} cover />
      </div>
    )
  }
  const cols = media.length === 2 || media.length === 4 ? 2 : 3
  const shown = media.slice(0, 9)
  const extra = media.length - shown.length
  return (
    <div className={`mt-2 grid gap-0.5 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {shown.map((f, i) => (
        <div key={f.id} className="relative aspect-square bg-line">
          <Thumb f={f} cover />
          {i === shown.length - 1 && extra > 0 && (
            <div className="absolute inset-0 bg-black/45 text-white text-xl font-semibold flex items-center justify-center">+{extra}</div>
          )}
        </div>
      ))}
    </div>
  )
}

export function Thumb({ f, cover }: { f: MediaItem; cover?: boolean }) {
  return (
    <>
      {f.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={f.thumbUrl} alt="" loading="lazy" className={`absolute inset-0 w-full h-full ${cover ? 'object-cover' : 'object-contain'}`} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted text-3xl">{f.kind === 'video' ? '🎬' : '🖼️'}</div>
      )}
      {f.kind === 'video' && (
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/55 text-white text-[11px]">▶ {fmtDuration(f.duration_sec)}</div>
      )}
    </>
  )
}
