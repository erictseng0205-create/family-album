import type { MediaItem } from '@/lib/db'

// 詳細頁的照片/影片:左右滑,一次一張
export default function MediaStrip({ media }: { media: MediaItem[] }) {
  if (media.length === 0) return null
  return (
    <div className="bg-black">
      <div className="snap-x-strip">
        {media.map((f) => (
          <div key={f.id} className="flex items-center justify-center" style={{ height: '62vh' }}>
            {f.kind === 'video' ? (
              <video
                src={f.url}
                poster={f.thumbUrl}
                controls
                playsInline
                preload="metadata"
                className="max-h-full max-w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url ?? f.thumbUrl} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <div className="text-center text-white/70 text-xs py-1">左右滑動看 {media.length} 張</div>
      )}
    </div>
  )
}
