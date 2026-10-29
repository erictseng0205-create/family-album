'use client'
import { useState } from 'react'

// 刪除要按兩次才算數(不用 confirm 視窗)
export default function DeleteButton({ id, action }: { id: string; action: (form: FormData) => Promise<void> }) {
  const [armed, setArmed] = useState(false)
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="px-4 py-2 rounded-full border border-line bg-card text-sm text-muted">
        🗑️ 刪除
      </button>
    )
  }
  return (
    <form action={action} className="flex gap-1">
      <input type="hidden" name="id" value={id} />
      <button className="px-4 py-2 rounded-full bg-red-500 text-white text-sm">確定刪除</button>
      <button type="button" onClick={() => setArmed(false)} className="px-3 py-2 rounded-full border border-line bg-card text-sm">取消</button>
    </form>
  )
}
