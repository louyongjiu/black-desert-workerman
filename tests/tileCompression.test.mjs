/* eslint-env node */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { compressTile, createTileCompressor, TILE_COMPRESSION } from '../scripts/tile-compression.mjs'
import { createRuntimeAssetPlan, writeRuntimeAssets } from '../scripts/runtime-assets.mjs'
import { createResourceUrl } from '../src/resourceUrls.mjs'

async function temporaryWorkspace(t) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'workerman-tiles-'))
  t.after(async () => {
    assert.equal(path.dirname(workspace), os.tmpdir())
    await rm(workspace, { recursive: true, force: true })
  })
  return workspace
}

async function detailedTile() {
  const pixels = Buffer.alloc(256 * 256 * 4)
  let seed = 7
  for (let pixel = 0; pixel < pixels.length; pixel += 4) {
    seed = (1664525 * seed + 1013904223) >>> 0
    pixels[pixel] = seed >>> 24
    pixels[pixel + 1] = (pixel / 4) % 256
    pixels[pixel + 2] = Math.floor(pixel / 1024)
    pixels[pixel + 3] = pixel < 256 * 4 * 16 ? 0 : 255
  }
  return sharp(pixels, { raw: { width: 256, height: 256, channels: 4 } })
    .webp({ quality: 90 }).toBuffer()
}

test('detailed tiles shrink to the selected resolution and retain transparency', async () => {
  const original = await detailedTile()
  const snapshot = Buffer.from(original)
  const compressed = await compressTile(original)
  assert.ok(compressed.length < original.length)
  assert.deepEqual(original, snapshot)
  const metadata = await sharp(compressed).metadata()
  assert.equal(metadata.format, 'webp')
  assert.equal(metadata.width, 192)
  assert.equal(metadata.height, 192)
  assert.equal(metadata.hasAlpha, true)
  const pixels = await sharp(compressed).ensureAlpha().raw().toBuffer()
  assert.equal(pixels[3], 0)
})

test('already small lossless tiles are kept byte-for-byte when encoding is no smaller', async () => {
  const original = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } })
    .webp({ lossless: true, effort: 6 }).toBuffer()
  assert.equal(await compressTile(original), original)
})

test('cached tiles are reused, incomplete entries are regenerated and settings invalidate the cache', async t => {
  const workspace = await temporaryWorkspace(t)
  const cacheDirectory = path.join(workspace, 'cache')
  const original = await detailedTile()
  const first = createTileCompressor({ cacheDirectory })
  const outputs = await Promise.all([first.compress(original), first.compress(original)])
  assert.deepEqual(outputs[0], outputs[1])
  assert.equal((await readdir(cacheDirectory)).length, 1)
  const warm = createTileCompressor({ cacheDirectory })
  assert.deepEqual(await warm.compress(original), outputs[0])
  assert.equal(warm.stats.cachedTiles, 1)
  const [filename] = await readdir(cacheDirectory)
  await writeFile(path.join(cacheDirectory, filename), outputs[0].subarray(0, 24))
  const recovered = createTileCompressor({ cacheDirectory })
  assert.deepEqual(await recovered.compress(original), outputs[0])
  assert.equal(recovered.stats.cachedTiles, 0)
  const smaller = createTileCompressor({ cacheDirectory, settings: { ...TILE_COMPRESSION, size: 128 } })
  const result = await smaller.compress(original)
  assert.equal(smaller.stats.cachedTiles, 0)
  assert.equal((await sharp(result).metadata()).width, 128)
  assert.equal((await readdir(cacheDirectory)).length, 2)
})

test('production output keeps tile paths and original source files, and hashes the selected bytes', async t => {
  const workspace = await temporaryWorkspace(t)
  await mkdir(path.join(workspace, 'data/maptiles/7'), { recursive: true })
  await mkdir(path.join(workspace, 'data/icons'), { recursive: true })
  const original = await detailedTile()
  const source = path.join(workspace, 'data/maptiles/7/-20_17.webp')
  await writeFile(source, original)
  await writeFile(path.join(workspace, 'data/icons/node.png'), 'unchanged icon')
  await writeFile(path.join(workspace, 'data/maptiles/whole.webp'), 'excluded whole map')
  const options = { groups: {}, files: [], directories: ['data/maptiles/', 'data/icons/'] }
  const first = await createRuntimeAssetPlan(workspace, options)
  const warm = await createRuntimeAssetPlan(workspace, options)
  assert.deepEqual(warm.manifest, first.manifest)
  assert.equal(warm.tileStats.cachedTiles, 1)
  assert.equal(first.tileStats.compressed, 1)
  assert.ok(first.tileStats.outputBytes < first.tileStats.originalBytes)
  await writeRuntimeAssets(workspace, first)
  assert.deepEqual(await readFile(source), original)
  const url = createResourceUrl(first.manifest, '/')('data/maptiles/7/-20_17.webp')
  assert.match(url, /^\/data\/[a-f0-9]{16}\/maptiles\/7\/-20_17\.webp$/)
  const output = await readFile(path.join(workspace, 'dist', url.slice(1)))
  assert.equal((await sharp(output).metadata()).width, 192)
  const icon = first.assets.find(asset => asset.output.endsWith('/icons/node.png'))
  assert.equal(icon.contents.toString(), 'unchanged icon')
  assert.ok(first.assets.every(asset => !asset.output.endsWith('whole.webp')))
  const changed = await createRuntimeAssetPlan(workspace, { ...options, tileCompression: { ...TILE_COMPRESSION, size: 128 } })
  assert.notEqual(changed.manifest['data/maptiles/'], first.manifest['data/maptiles/'])
  assert.equal(changed.manifest['data/icons/'], first.manifest['data/icons/'])
})

test('invalid source tiles fail the build with their path instead of being silently published', async t => {
  const workspace = await temporaryWorkspace(t)
  await mkdir(path.join(workspace, 'data/maptiles/6'), { recursive: true })
  await writeFile(path.join(workspace, 'data/maptiles/6/1_2.webp'), 'invalid webp')
  await assert.rejects(createRuntimeAssetPlan(workspace, {
    groups: {}, files: [], directories: ['data/maptiles/'],
  }), /Failed to compress map tile data\/maptiles\/6\/1_2\.webp/)
})
