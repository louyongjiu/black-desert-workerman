/* eslint-env node */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DATASET_GROUPS } from '../src/dataLoading.mjs'
import { createTileCompressor } from './tile-compression.mjs'

export const RUNTIME_FILES = [
  'data/plantzone.json',
  'data/deck_icons.json', 'data/deck_icon_positions.json', 'data/deck_links.json',
  'data/deck_rg_graphs.json', 'data/deck_r_origins.json',
  'data/rg_latest.geojson', 'data/r_latest.geojson',
  'data/houseinforeceipe.json', 'data/manual/calculated_prices.json',
  'data/manual/yields_observed_202606.json',
  'data/manual/catches_by_fish.json', 'data/manual/sightings_top_sizes.json',
  'data/encyclopedia.json',
  ...['en', 'jp', 'ko', 'ru', 'tw'].map(language => `data/loc/${language}.json`),
]
const directories = ['data/icons/', 'data/maptiles/', 'data/images/']

function digest(contents) {
  return createHash('sha256').update(contents).digest('hex').slice(0, 16)
}

async function walk(workspace, directory) {
  const entries = await readdir(path.join(workspace, directory), { withFileTypes: true })
  const files = await Promise.all(entries.map(entry => {
    const relative = directory + entry.name
    if (entry.isDirectory()) return walk(workspace, relative + '/')
    if (!entry.isFile()) throw new Error(`Unsupported runtime asset: ${relative}`)
    return [relative]
  }))
  return files.flat().sort()
}

async function batches(entries, fn, limit = 32) {
  for (let offset = 0; offset < entries.length; offset += limit) {
    await Promise.all(entries.slice(offset, offset + limit).map(fn))
  }
}

export async function createRuntimeAssetPlan(workspace, options = {}) {
  const manifest = {}
  const assets = []
  let tileStats
  const addJson = (relative, value) => {
    const contents = Buffer.from(JSON.stringify(value))
    const output = `data/${digest(contents)}/${relative.slice(5)}`
    manifest[relative] = output
    assets.push({ output, contents })
  }
  for (const [group, datasets] of Object.entries(options.groups ?? DATASET_GROUPS)) {
    const values = await Promise.all(Object.entries(datasets).map(async ([key, file]) =>
      [key, JSON.parse(await readFile(path.join(workspace, file), 'utf8'))],
    ))
    addJson(`data/game-${group}.json`, Object.fromEntries(values))
  }
  for (const file of options.files ?? RUNTIME_FILES) {
    addJson(file, JSON.parse(await readFile(path.join(workspace, file), 'utf8')))
  }
  for (const directory of options.directories ?? directories) {
    const files = (await walk(workspace, directory)).filter(file => file !== 'data/maptiles/whole.webp')
    const hashed = new Map()
    const isTile = file => /^data\/maptiles\/\d+\/-?\d+_-?\d+\.webp$/.test(file)
    const compressor = directory === 'data/maptiles/' ? createTileCompressor({
      cacheDirectory: path.join(workspace, '.cache', 'maptiles'),
      settings: options.tileCompression,
    }) : undefined
    const totalTiles = compressor ? files.filter(isTile).length : 0
    await batches(files, async file => {
      let contents = await readFile(path.join(workspace, file))
      if (compressor && isTile(file)) {
        try { contents = await compressor.compress(contents) }
        catch (error) { throw new Error(`Failed to compress map tile ${file}`, { cause: error }) }
        if (compressor.stats.count % 1000 === 0 || compressor.stats.count === totalTiles) {
          options.onTileProgress?.({ ...compressor.stats, total: totalTiles })
        }
      }
      hashed.set(file, { contents, hash: digest(contents) })
    }, compressor ? 8 : 32)
    if (compressor) tileStats = { ...compressor.stats }
    // Sorted paths and content hashes keep the URL stable across unchanged builds.
    const version = digest(files.map(file => `${file}\0${hashed.get(file).hash}\n`).join(''))
    const prefix = `data/${version}/${directory.slice(5)}`
    manifest[directory] = prefix
    for (const file of files) assets.push({ output: prefix + file.slice(directory.length), contents: hashed.get(file).contents })
  }
  return { manifest, assets, tileStats }
}

export async function writeRuntimeAssets(workspace, plan) {
  const dist = path.resolve(workspace, 'dist')
  const target = path.resolve(dist, 'data')
  if (path.relative(path.resolve(workspace), target) !== path.join('dist', 'data')) {
    throw new Error(`Refusing to clear runtime output outside dist/data: ${target}`)
  }
  await rm(target, { recursive: true, force: true })
  await batches(plan.assets, async ({ output, contents }) => {
    const filename = path.resolve(dist, output)
    if (!filename.startsWith(target + path.sep)) throw new Error(`Invalid runtime output: ${output}`)
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, contents)
  })
}
