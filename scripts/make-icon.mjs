/**
 * Zero-dependency brand asset generator.
 *
 * Renders the obsidian + warm-peach Antigravity Pulse orbit mark analytically
 * (so every icon size is crisp) and writes:
 *   build/icon.png  256x256 PNG
 *   build/icon.ico  Windows multi-resolution ICO (256/128/64/48/32/16)
 *   build/tray.png  32x32 transparent tray glyph
 *
 * Run with: npm run icon
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD = resolve(ROOT, 'build')

const ACCENT = [255, 199, 153]
const ACCENT_DARK = [214, 143, 95]
const OBSIDIAN_TOP = [18, 24, 33]
const OBSIDIAN_BOTTOM = [2, 3, 5]
const WHITE = [255, 255, 255]
const TRAY_DISC = [10, 13, 18]

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function mixColor(a, b, amount) {
  const weight = clamp(amount)
  return [
    a[0] + (b[0] - a[0]) * weight,
    a[1] + (b[1] - a[1]) * weight,
    a[2] + (b[2] - a[2]) * weight
  ]
}

/** Source-over compositing of premultiplied-safe straight RGBA values. */
function paint(pixel, color, alpha) {
  const amount = clamp(alpha)
  if (amount <= 0) return
  const index = pixel.index * 4
  const backgroundAlpha = pixel.data[index + 3] / 255
  const outAlpha = amount + backgroundAlpha * (1 - amount)
  if (outAlpha <= 0) return
  for (let channel = 0; channel < 3; channel += 1) {
    const foreground = color[channel] * amount
    const background = pixel.data[index + channel] * backgroundAlpha * (1 - amount)
    pixel.data[index + channel] = clamp(Math.round((foreground + background) / outAlpha), 0, 255)
  }
  pixel.data[index + 3] = Math.round(outAlpha * 255)
}

function roundedBoxDistance(x, y, halfExtent, radius) {
  const qx = Math.abs(x) - (halfExtent - radius)
  const qy = Math.abs(y) - (halfExtent - radius)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

function renderMark(size, variant = 'app') {
  const data = new Uint8Array(size * size * 4)
  const aa = 1.35 / size
  const rotation = -0.36
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const isTray = variant === 'tray'
  const halfExtent = isTray ? 1 : 0.88
  const radius = isTray ? 1 : 0.235

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = ((x + 0.5) / size) * 2 - 1
      const py = ((y + 0.5) / size) * 2 - 1
      const pixel = { index: y * size + x, data }

      // Frame: rounded obsidian tile for the app, translucent dark disc for the tray.
      const frameDistance = isTray
        ? Math.hypot(px, py) - halfExtent
        : roundedBoxDistance(px, py, halfExtent, radius)
      const frameCoverage = 1 - smoothstep(-aa, aa, frameDistance)
      const gradient = clamp((1 - px + py) / 2.8)
      const tile = mixColor(OBSIDIAN_BOTTOM, OBSIDIAN_TOP, gradient)
      const frameColor = isTray ? [...TRAY_DISC] : tile
      paint(pixel, frameColor, frameCoverage * (isTray ? 0.86 : 1))

      // Bevel: 1px inner highlight on the top-left, soft dark lip on the bottom-right.
      if (!isTray) {
        const inner = 1 - smoothstep(-0.045, -0.012, Math.abs(frameDistance))
        const directional = clamp((-px - py + 1.4) / 2.8)
        paint(pixel, WHITE, inner * (0.08 + directional * 0.16))
      }

      // Orbit ring, slightly tilted so the mark reads as an agent "pulse".
      const rx = px * cos - py * sin
      const ry = px * sin + py * cos
      const ringRadius = Math.hypot(rx, ry * 1.16)
      const ringDistance = Math.abs(ringRadius - 0.53) - (isTray ? 0.095 : 0.085)

      // Warm bloom just outside the ring.
      const bloom = Math.exp(-Math.max(0, ringDistance) * 16) * 0.13
      paint(pixel, ACCENT, bloom * frameCoverage)

      const ringCoverage = (1 - smoothstep(-aa, aa, ringDistance)) * frameCoverage
      const ringShade = clamp((0.6 - py) / 1.6)
      paint(pixel, mixColor(ACCENT_DARK, ACCENT, ringShade), ringCoverage)

      // Satellite travelling on the orbit — keeps the silhouette distinct at 16px.
      const satelliteDistance = Math.hypot(px - 0.42, py + 0.31) - (isTray ? 0.105 : 0.095)
      paint(pixel, WHITE, (1 - smoothstep(-aa, aa, satelliteDistance)) * frameCoverage * 0.96)

      // Core and its bright centre.
      const coreDistance = Math.hypot(px, py) - (isTray ? 0.2 : 0.19)
      const coreEdge = 1 - smoothstep(-aa, aa, coreDistance)
      paint(pixel, ACCENT, coreEdge * frameCoverage)
      const centreDistance = Math.hypot(px + 0.025, py + 0.03) - 0.062
      paint(pixel, WHITE, (1 - smoothstep(-aa, aa, centreDistance)) * frameCoverage * 0.9)
    }
  }

  return data
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let value = n
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[n] = value >>> 0
  }
  return table
})()

function crc32(buffer) {
  let value = 0xffffffff
  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

function pngChunk(type, body) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(body.length, 0)
  const label = Buffer.from(type, 'ascii')
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([label, body])), 0)
  return Buffer.concat([length, label, body, checksum])
}

function encodePng(pixels, size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  header[10] = 0
  header[11] = 0
  header[12] = 0

  const scanlines = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1)
    scanlines[rowStart] = 0 // filter: none
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(scanlines, rowStart + 1)
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function bgraFrame(pixels, size) {
  const rowBytes = size * 4
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8) // XOR bitmap + AND mask
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(0, 16)

  const bitmap = Buffer.alloc(rowBytes * size)
  for (let y = 0; y < size; y += 1) {
    const sourceRow = size - 1 - y // ICO stores rows bottom-up
    for (let x = 0; x < size; x += 1) {
      const source = (sourceRow * size + x) * 4
      const target = (y * size + x) * 4
      bitmap[target] = pixels[source + 2]
      bitmap[target + 1] = pixels[source + 1]
      bitmap[target + 2] = pixels[source]
      bitmap[target + 3] = pixels[source + 3]
    }
  }

  const maskStride = Math.ceil(size / 32) * 4
  const mask = Buffer.alloc(maskStride * size) // all zero = use alpha channel
  return Buffer.concat([header, bitmap, mask])
}

function encodeIco(frames) {
  const count = frames.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  const directory = Buffer.alloc(count * 16)
  let offset = 6 + directory.length
  const bodies = []
  frames.forEach((frame, index) => {
    const entry = index * 16
    directory[entry] = frame.size >= 256 ? 0 : frame.size
    directory[entry + 1] = frame.size >= 256 ? 0 : frame.size
    directory[entry + 2] = 0
    directory[entry + 3] = 0
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(frame.body.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += frame.body.length
    bodies.push(frame.body)
  })

  return Buffer.concat([header, directory, ...bodies])
}

mkdirSync(BUILD, { recursive: true })

const sizes = [256, 128, 64, 48, 32, 16]
const frames = sizes.map((size) => ({ size, body: bgraFrame(renderMark(size), size) }))

writeFileSync(resolve(BUILD, 'icon.png'), encodePng(renderMark(256), 256))
writeFileSync(resolve(BUILD, 'icon.ico'), encodeIco(frames))
writeFileSync(resolve(BUILD, 'tray.png'), encodePng(renderMark(32, 'tray'), 32))

console.log('[pulse] wrote build/icon.png (256px), build/icon.ico (6 sizes), build/tray.png (32px)')
