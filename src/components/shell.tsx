import Link from 'next/link'
import type { Album } from '@/lib/db'
import type { Member } from '@/lib/auth'
import { APP_NAME } from '@/lib/config'

// 每一頁共用的外框:上面標題+相簿分頁,下面三個按鈕
export default function Shell({
  member,
  albums,
  current,
  showTabs = true,
  children,
}: {
  member: Member
  albums?: Album[]
  current?: string | null
  showTabs?: boolean
  children: React.ReactNode
}) {
  const familyAlbums = (albums ?? []).filter((a) => a.visibility === 'family')
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur border-b border-line safe-top">
        <div className="max-w-xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-brand-deep">{APP_NAME}</Link>
          <span className="text-sm text-muted">{member.name}</span>
        </div>
        {showTabs && albums && albums.length > 0 && (
          <nav className="max-w-xl mx-auto px-3 pb-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {familyAlbums.length > 1 && <Tab href="/" active={!current} label="全部" />}
            {albums.map((a) => (
              <Tab key={a.id} href={`/?album=${a.id}`} active={current === a.id} label={a.visibility === 'admins' ? `🔒 ${a.name}` : a.name} />
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1 max-w-xl w-full mx-auto px-3 py-3 pb-24">{children}</main>
      <footer className="fixed bottom-0 inset-x-0 z-20 bg-card/95 backdrop-blur border-t border-line safe-bottom">
        <div className="max-w-xl mx-auto grid grid-cols-3 text-center text-sm pt-2">
          <Link href="/" className="py-1 text-ink">🏠<div>時光</div></Link>
          <Link href="/upload" className="py-1 text-ink">📷<div>上傳</div></Link>
          <Link href="/settings" className="py-1 text-ink">⚙️<div>設定</div></Link>
        </div>
      </footer>
    </div>
  )
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`shrink-0 px-3 py-1 rounded-full text-sm border ${active ? 'bg-brand text-white border-brand' : 'bg-card text-ink border-line'}`}
    >
      {label}
    </Link>
  )
}
