import { requireMember } from '@/lib/auth'
import { visibleAlbums } from '@/lib/db'
import Shell from '@/components/shell'
import UploadForm from './upload-form'

export const dynamic = 'force-dynamic'

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  const member = await requireMember()
  const albums = await visibleAlbums(member)
  const { album } = await searchParams
  const defaultAlbum = albums.find((a) => a.id === album)?.id ?? albums.find((a) => a.visibility === 'family')?.id ?? albums[0]?.id ?? ''
  return (
    <Shell member={member} albums={albums} showTabs={false}>
      <h1 className="text-lg font-bold mb-3">上傳照片 / 影片</h1>
      {albums.length === 0 ? (
        <p className="text-muted">還沒有相簿,請先到「設定」新增。</p>
      ) : (
        <UploadForm albums={albums.map((a) => ({ id: a.id, name: a.name }))} defaultAlbum={defaultAlbum} />
      )}
    </Shell>
  )
}
