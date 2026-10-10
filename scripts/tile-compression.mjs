/* eslint-env node */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export const TILE_COMPRESSION = Object.freeze({ size: 192, quality: 60, effort: 6 })

export async function compressTile(contents, settings = TILE_COMPRESSION) {
  const candidate = await sharp(contents)
    .resize(settings.size, settings.size, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    .webp({ quality: settings.quality, effort: settings.effort, alphaQuality: 100 })
    .toBuffer()
  return candidate.length < contents.length ? candidate : contents
}

function completeWebp(contents) {
  return contents.length >= 12 && contents.toString('ascii', 0, 4) === 'RIFF'
    && contents.toString('ascii', 8, 12) === 'WEBP'
    && contents.readUInt32LE(4) + 8 === contents.length
}

export function createTileCompressor({ cacheDirectory, settings = TILE_COMPRESSION } = {}) {
  const profile = JSON.stringify({
    // Increment the revision if the resize or selection algorithm changes.
    revision: 1, ...settings,
    sharp: sharp.versions.sharp, vips: sharp.versions.vips, webp: sharp.versions.webp,
  })
  const pending = new Map()
  const stats = { count: 0, compressed: 0, keptOriginal: 0, cachedTiles: 0, originalBytes: 0, outputBytes: 0 }

  async function encode(contents, key) {
    const filename = cacheDirectory && path.join(cacheDirectory, `${key}.webp`)
    if (filename) {
      let cached
      try { cached = await readFile(filename) }
      catch (error) { if (error.code !== 'ENOENT') throw error }
      if (cached?.equals(contents)) return { contents, cached: true }
      if (cached && cached.length < contents.length && completeWebp(cached)) {
        try {
          const metadata = await sharp(cached).metadata()
          if (metadata.format === 'webp' && metadata.width <= settings.size && metadata.height <= settings.size) {
            return { contents: cached, cached: true }
          }
        } catch { /* Regenerate an invalid cache entry from the original tile. */ }
      }
    }
    const selected = await compressTile(contents, settings)
    if (filename) {
      await mkdir(cacheDirectory, { recursive: true })
      const temporary = `${filename}.${process.pid}-${randomUUID()}.tmp`
      try {
        await writeFile(temporary, selected)
        await rename(temporary, filename)
      } finally {
        await rm(temporary, { force: true })
      }
    }
    return { contents: selected, cached: false }
  }

  return {
    stats,
    async compress(contents) {
      const key = createHash('sha256').update(profile).update(contents).digest('hex')
      if (!pending.has(key)) {
        const request = encode(contents, key).catch(error => { pending.delete(key); throw error })
        pending.set(key, request)
      }
      const result = await pending.get(key)
      stats.count++
      stats.originalBytes += contents.length
      stats.outputBytes += result.contents.length
      if (result.contents.length < contents.length) stats.compressed++
      else stats.keptOriginal++
      if (result.cached) stats.cachedTiles++
      return result.contents
    },
  }
}
