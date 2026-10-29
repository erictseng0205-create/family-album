import { requireMember } from '@/lib/auth'
import { visibleAlbums, listMoments } from '@/lib/db'
import Shell from '@/components/shell'
import Timeline from '@/components/timeline'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  const member = await requireMember()
  const albums = await visibleAlbums(member)
  const { album } = await searchParams
  const picked = album ? albums.find((a) => a.id === album) : undefined
  const familyIds = albums.filter((a) => a.visibility === 'family').map((a) => a.id)
  const ids = picked ? [picked.id] : familyIds.length > 0 ? familyIds : albums.map((a) => a.id)
  const { items, next } = await listMoments(ids, null)
  return (
    <Shell member={member} albums={albums} current={picked?.id ?? null}>
      <Timeline initial={items} next={next} albums={albums} albumParam={ids.join(',')} showAlbum={!picked && ids.length > 1} />
    </Shell>
  )
}
