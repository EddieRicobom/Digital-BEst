import { crc32, deflateSync } from 'node:zlib'

function pngChunk(type, data) {
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length)
  chunk.write(type, 4, 4, 'ascii')
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length)
  return chunk
}

export function createSpriteStrip(pixels, frames, width, height, frameCount, optionalFrames = []) {
  if (frames.length !== frameCount) throw new Error(`Esperados ${frameCount} frames, recebidos ${frames.length}`)
  const stripWidth = width * frameCount
  const stride = stripWidth * 4 + 1
  const rows = Buffer.alloc(height * stride)
  for (const [frameIndex, frame] of frames.entries()) {
    const { byteOffset, byteLength } = frame
    // Some babies use 1×1 placeholders in slots for actions they cannot perform.
    if (optionalFrames.includes(frameIndex) && frame.width === 1 && frame.height === 1) continue
    if (frame.invalid || frame.width !== width || frame.height !== height ||
        byteLength !== width * height * 2 || byteOffset < 0 || byteOffset + byteLength > pixels.length) {
      throw new Error(`Frame inválido: ${frameIndex} (${width}×${height})`)
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rgb = pixels.readUInt16LE(byteOffset + 2 * (y * width + x))
        // BEM reserves bright green as the transparent color key.
        if (rgb === 0x07e0) continue
        const dest = y * stride + 1 + (frameIndex * width + x) * 4
        rows[dest] = Math.floor((rgb >> 11) * 255 / 31)
        rows[dest + 1] = Math.floor(((rgb >> 5) & 63) * 255 / 63)
        rows[dest + 2] = Math.floor((rgb & 31) * 255 / 31)
        rows[dest + 3] = 255
      }
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(stripWidth)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
