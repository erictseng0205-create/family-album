export const APP_NAME = '家的時光'
export const BUCKET = 'media'
export const PAGE_SIZE = 30

// 正式網址:沒設 APP_URL 就用 Vercel 自動給的正式網域
export function appUrl() {
  const fromEnv = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  return (fromEnv || 'http://localhost:3000').replace(/\/$/, '')
}
