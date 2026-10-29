// 產 PWA 圖示:珊瑚橘圓角方塊 + 白色小房子
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="110" fill="#ef8a6b"/>
<path d="M256 118 L118 240 L158 240 L158 392 L228 392 L228 310 L284 310 L284 392 L354 392 L354 240 L394 240 Z" fill="#fff"/>
<circle cx="256" cy="262" r="24" fill="#ef8a6b"/>
</svg>`
mkdirSync('public', { recursive: true })
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/${name}`)
}
console.log('icons ok')
