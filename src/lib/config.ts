export const APP_NAME = '家的時光'
export const BUCKET = 'media'
export const PAGE_SIZE = 30
export function appUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}
