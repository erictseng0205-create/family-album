import type { MetadataRoute } from 'next'
import { APP_NAME } from '@/lib/config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: '我們家的照片時光軸',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffaf6',
    theme_color: '#ef8a6b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
