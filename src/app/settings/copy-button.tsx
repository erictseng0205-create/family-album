'use client'
import { useState } from 'react'

export default function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500) } catch { window.prompt('複製這個連結', text) }
      }}
      className="px-3 py-1 rounded-full border border-line text-xs"
    >
      {ok ? '已複製' : '複製連結'}
    </button>
  )
}
