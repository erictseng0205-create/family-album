import { redirect } from 'next/navigation'
import { getMember } from '@/lib/auth'
import { APP_NAME } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function Welcome() {
  if (await getMember()) redirect('/')
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-4">🏠</div>
      <h1 className="text-2xl font-bold text-brand-deep mb-3">{APP_NAME}</h1>
      <p className="text-muted leading-relaxed">
        這是我們家的私人相簿。
        <br />
        要看的話,請跟 Eric 要「邀請連結」,點開就能進來。
      </p>
    </main>
  )
}
