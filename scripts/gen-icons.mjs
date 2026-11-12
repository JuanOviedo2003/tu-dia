// Genera PNG del ícono de Tu Día (icon-180/192/512.png) desde el diseño
// de public/icon.svg (64x64). Sin dependencias fuera de pngjs (devDep).
// Uso: node scripts/gen-icons.mjs
import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'

const SIZES = [180, 192, 512]
const SS = 4 // supersampling

const BLUE = [59, 130, 246] // #3b82f6
const DARK = [29, 78, 216] // #1d4ed8
const WHITE = [255, 255, 255]
// blanco 70% sobre #3b82f6 (misma opacidad que el SVG)
const WHITE70 = WHITE.map((w, i) => Math.round(w * 0.7 + BLUE[i] * 0.3))

function makeCanvas(size) {
  return { size, data: new Float64Array(size * size * 4) } // RGBA premultiplicado
}

function px(c, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return
  const i = (y * c.size + x) * 4
  c.data[i] = r * a
  c.data[i + 1] = g * a
  c.data[i + 2] = b * a
  c.data[i + 3] = a
}

// Rectángulo redondeado en unidades del sistema 64, escalado por s.
function fillRoundRect(c, x0, y0, w, h, r, color, s) {
  const X0 = x0 * s
  const Y0 = y0 * s
  const W = w * s
  const H = h * s
  const R = r * s
  for (let y = Math.floor(Y0); y < Y0 + H; y++) {
    for (let x = Math.floor(X0); x < X0 + W; x++) {
      const lx = x - X0
      const ly = y - Y0
      let inside = true
      if (lx < R && ly < R) inside = (lx - R) ** 2 + (ly - R) ** 2 <= R * R
      else if (lx >= W - R && ly < R) inside = (lx - (W - R)) ** 2 + (ly - R) ** 2 <= R * R
      else if (lx < R && ly >= H - R) inside = (lx - R) ** 2 + (ly - (H - R)) ** 2 <= R * R
      else if (lx >= W - R && ly >= H - R) {
        inside = (lx - (W - R)) ** 2 + (ly - (H - R)) ** 2 <= R * R
      }
      if (inside) px(c, x, y, color, 255)
    }
  }
}

function fillRect(c, x0, y0, w, h, color, s) {
  const X0 = Math.floor(x0 * s)
  const Y0 = Math.floor(y0 * s)
  const W = Math.round(w * s)
  const H = Math.round(h * s)
  for (let y = Y0; y < Y0 + H; y++) {
    for (let x = X0; x < X0 + W; x++) px(c, x, y, color, 255)
  }
}

function buildHi(size) {
  const s = (size * SS) / 64
  const c = makeCanvas(size * SS)
  fillRoundRect(c, 6, 10, 52, 48, 8, BLUE, s) // cuerpo
  fillRoundRect(c, 6, 10, 52, 12, 8, DARK, s) // banda superior
  fillRect(c, 6, 17, 52, 5, DARK, s) // esquinas inferiores de la banda rectas
  fillRoundRect(c, 16, 4, 6, 12, 3, DARK, s) // pestañas (encima de la banda)
  fillRoundRect(c, 42, 4, 6, 12, 3, DARK, s)
  fillRect(c, 14, 30, 10, 8, WHITE, s) // cuadrícula
  fillRect(c, 28, 30, 10, 8, WHITE70, s)
  fillRect(c, 42, 30, 10, 8, WHITE70, s)
  fillRect(c, 14, 42, 10, 8, WHITE70, s)
  fillRect(c, 28, 42, 10, 8, WHITE70, s)
  return c
}

function downsample(hi, size) {
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sr = 0
      let sg = 0
      let sb = 0
      let sa = 0
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * hi.size + (x * SS + dx)) * 4
          sr += hi.data[i]
          sg += hi.data[i + 1]
          sb += hi.data[i + 2]
          sa += hi.data[i + 3]
        }
      }
      const n = SS * SS
      const o = (y * size + x) * 4
      out[o] = sa > 0 ? Math.round(sr / sa) : 0
      out[o + 1] = sa > 0 ? Math.round(sg / sa) : 0
      out[o + 2] = sa > 0 ? Math.round(sb / sa) : 0
      out[o + 3] = Math.round(sa / n)
    }
  }
  return out
}

for (const size of SIZES) {
  const png = new PNG({ width: size, height: size })
  downsample(buildHi(size), size).copy(png.data)
  writeFileSync(`public/icon-${size}.png`, PNG.sync.write(png))
  console.log(`public/icon-${size}.png OK (${size}x${size})`)
}
