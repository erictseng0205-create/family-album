// 「幾歲幾個月」:照時光小屋的算法,出生當天算第 1 天
export function ageLabel(birthday: string | null | undefined, on: string): string | null {
  if (!birthday) return null
  const b = new Date(birthday + 'T00:00:00')
  const d = new Date(on + 'T00:00:00')
  if (isNaN(b.getTime()) || isNaN(d.getTime())) return null
  if (d < b) {
    const days = Math.round((b.getTime() - d.getTime()) / 86400000)
    return `出生前 ${days} 天`
  }
  let years = d.getFullYear() - b.getFullYear()
  let months = d.getMonth() - b.getMonth()
  let days = d.getDate() - b.getDate()
  if (days < 0) {
    months -= 1
    const prevMonthEnd = new Date(d.getFullYear(), d.getMonth(), 0).getDate()
    days += prevMonthEnd
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  if (years > 0) return months > 0 ? `${years}歲${months}個月` : `${years}歲`
  if (months > 0) return days > 0 ? `${months}個月${days}天` : `${months}個月`
  return `第 ${days + 1} 天`
}

export function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  const w = '日一二三四五六'[d.getDay()]
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日(${w})`
}

export function fmtDuration(sec: number | null | undefined) {
  if (!sec) return ''
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
