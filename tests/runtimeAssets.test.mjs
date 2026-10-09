import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createRuntimeAssetPlan, writeRuntimeAssets } from '../scripts/runtime-assets.mjs'
import { createResourceUrl } from '../src/resourceUrls.mjs'
import { DATASET_GROUPS } from '../src/dataLoading.mjs'
import { loadRouteData, routeDataRequirements } from '../src/routeData.mjs'

test('versioned bundles retain every original dataset value', async () => {
  const workspace = fileURLToPath(new URL('..', import.meta.url))
  const plan = await createRuntimeAssetPlan(workspace, { files: [], directories: [] })
  for (const [group, datasets] of Object.entries(DATASET_GROUPS)) {
    const bundle = plan.assets.find(asset => asset.output === plan.manifest[`data/game-${group}.json`])
    const values = JSON.parse(bundle.contents)
    assert.deepEqual(Object.keys(values), Object.keys(datasets))
    for (const [key, file] of Object.entries(datasets)) {
      assert.deepEqual(values[key], JSON.parse(await readFile(path.join(workspace, file), 'utf8')), file)
    }
  }
})

test('content versions stay stable across builds and change only for modified resources', async t => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'workerman-assets-'))
  t.after(async () => {
    assert.equal(path.dirname(workspace), os.tmpdir())
    await rm(workspace, { recursive: true, force: true })
  })
  await mkdir(path.join(workspace, 'data/icons'), { recursive: true })
  await writeFile(path.join(workspace, 'data/example.json'), '{ "value": 1 }')
  await writeFile(path.join(workspace, 'data/icons/item.webp'), 'image one')
  const options = { groups: {}, files: ['data/example.json'], directories: ['data/icons/'] }
  const first = await createRuntimeAssetPlan(workspace, options)
  await writeFile(path.join(workspace, 'data/example.json'), '{\n  "value": 1\n}')
  const same = await createRuntimeAssetPlan(workspace, options)
  assert.deepEqual(same.manifest, first.manifest)
  await writeFile(path.join(workspace, 'data/example.json'), '{"value":2}')
  const changed = await createRuntimeAssetPlan(workspace, options)
  assert.notEqual(changed.manifest['data/example.json'], first.manifest['data/example.json'])
  assert.equal(changed.manifest['data/icons/'], first.manifest['data/icons/'])
  await writeFile(path.join(workspace, 'data/icons/item.webp'), 'image two')
  const imageChanged = await createRuntimeAssetPlan(workspace, options)
  assert.notEqual(imageChanged.manifest['data/icons/'], changed.manifest['data/icons/'])
  await mkdir(path.join(workspace, 'dist/data'), { recursive: true })
  await writeFile(path.join(workspace, 'dist/data/obsolete.json'), '{}')
  await writeRuntimeAssets(workspace, imageChanged)
  await assert.rejects(readFile(path.join(workspace, 'dist/data/obsolete.json')), { code: 'ENOENT' })
  assert.deepEqual(JSON.parse(await readFile(path.join(workspace, imageChanged.assets[0].output.replace(/^data\//, 'dist/data/')))), { value: 2 })
})

test('resource URLs preserve map placeholders, use content versions and support a separate CDN', () => {
  const resolve = createResourceUrl({
    'data/core.json': 'data/1111111111111111/core.json',
    'data/maptiles/': 'data/2222222222222222/maptiles/',
  }, 'https://assets.example.com/workerman/')
  assert.equal(resolve('data/core.json'), 'https://assets.example.com/workerman/data/1111111111111111/core.json')
  assert.equal(resolve('data/maptiles/{z}/{x}_{y}.webp'), 'https://assets.example.com/workerman/data/2222222222222222/maptiles/{z}/{x}_{y}.webp')
  assert.equal(resolve('https://market.example.com'), 'https://market.example.com')
})

test('route loading skips planner and WASM payloads on independent pages', async () => {
  const user = { selectedLang: 'en', userWorkers: [], wasmRouting: false }
  const calls = []
  const game = Object.fromEntries(['fetchData', 'fetchPlannerData', 'loadReferenceData', 'loadLanguage', 'initWasmRouter']
    .map(name => [name, async () => { calls.push(name) }]))
  const market = { apiDatetime: Date.now(), apiFetching: false }
  await loadRouteData('/fishsize', user, game, market)
  assert.deepEqual(calls, [])
  await loadRouteData('/about', user, game, market)
  assert.deepEqual(calls.splice(0), ['loadReferenceData'])
  await loadRouteData('/regionmap', user, game, market)
  assert.deepEqual(calls.splice(0), ['loadLanguage'])
  await loadRouteData('/plantzones', user, game, market)
  assert.deepEqual(calls.splice(0), ['fetchData'])
  await loadRouteData('/', user, game, market)
  assert.deepEqual(calls.splice(0), ['fetchData', 'fetchPlannerData'])
  user.wasmRouting = true
  await loadRouteData('/', user, game, market)
  assert.deepEqual(calls.splice(0), ['fetchData', 'fetchPlannerData', 'initWasmRouter'])
  user.userWorkers.push({ job: { kind: 'workshop', hk: 1 } })
  assert.equal(routeDataRequirements('/plantzones', user).planner, true)
  assert.equal(routeDataRequirements('/routertests', { ...user, wasmRouting: false }).wasm, true)
})

test('an unavailable optional WASM planner falls back while router tests still report failure', async t => {
  t.mock.method(console, 'error', () => {})
  const user = { selectedLang: 'en', userWorkers: [], wasmRouting: true }
  const game = {
    fetchData: async () => {}, fetchPlannerData: async () => {},
    initWasmRouter: async () => { throw new Error('WASM unavailable') },
  }
  const market = { apiDatetime: Date.now(), apiFetching: false }
  await loadRouteData('/', user, game, market)
  assert.equal(user.wasmRouting, false)
  await assert.rejects(loadRouteData('/routertests', user, game, market), /WASM unavailable/)
})
