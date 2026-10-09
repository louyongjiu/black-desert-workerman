import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { reactive, computed, markRaw } from 'vue'
import { loadDatasets, fetchJson } from '../src/dataLoading.mjs'
import { buildDistanceIndex, medianWorkerStats } from '../src/gameLookups.mjs'
import { persistStore } from '../src/persistence.mjs'
import { selectObservation } from '../src/droprateSelection.mjs'

test('observation selection initializes all three levels and preserves valid choices', () => {
  const data = { 131: { 7003: { goblin: [1], giant: [2] } }, 132: { 7004: { human: [3] } } }
  assert.deepEqual(selectObservation(data, { selected_pzk: '', selected_ik: '', selected_specie: '' }), {
    selected_pzk: '131', selected_ik: '7003', selected_specie: 'goblin',
  })
  assert.deepEqual(selectObservation(data, { selected_pzk: '132', selected_ik: '7003', selected_specie: 'giant' }), {
    selected_pzk: '132', selected_ik: '7004', selected_specie: 'human',
  })
  const valid = { selected_pzk: '131', selected_ik: '7003', selected_specie: 'giant' }
  assert.deepEqual(selectObservation(data, valid), valid)
  assert.deepEqual(selectObservation({}, valid), { selected_pzk: '', selected_ik: '', selected_specie: '' })
})

test('town candidates ignore prices and invalidate when routing inputs change', () => {
  const user = reactive({ selectedTax: 0.8, activateAncado: false })
  const source = readFileSync(new URL('../src/stores/game.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace('export const useGameStore =', 'const useGameStore =')
  const options = vm.runInNewContext(`${source}\nuseGameStore`, {
    defineStore: options => options,
    useUserStore: () => user,
    Heap: createRequire(import.meta.url)('heap'),
  })
  let searches = 0
  const game = reactive({
    ready: true, plantzoneDrops: markRaw({ 2: {} }),
    nodes: markRaw({ 1: { CP: 0 }, 2: { CP: 1 } }),
    links: markRaw({ 1: [2], 2: [1] }),
    townsConnectionRoots: new Set([1]), townsWithLodgingSet: new Set([1]),
    dijkstraNearestTowns(...args) {
      searches++
      return options.actions.dijkstraNearestTowns.apply(this, args)
    },
  })
  const viewSource = readFileSync(new URL('../src/views/PlantzonesView.vue', import.meta.url), 'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*\r?\n/gm, '').replace('export default', 'const view =')
  const view = vm.runInNewContext(`${viewSource}\nview`, { formatFixed() {}, PlantzonesRow: {} })
  const instance = { gameStore: game, mediahNodes: new Set() }
  const candidates = computed(() => view.computed.nearestTownCandidates.call(instance))
  const initial = candidates.value
  assert.equal(searches, 1)
  user.selectedTax = 0.9
  assert.equal(candidates.value, initial)
  assert.equal(searches, 1)
  user.activateAncado = true
  assert.notEqual(candidates.value, initial)
  assert.equal(searches, 2)
  game.nodes = markRaw({ ...game.nodes })
  candidates.value
  assert.equal(searches, 3)
  game.links = markRaw({ ...game.links })
  candidates.value
  assert.equal(searches, 4)
})

test('starts all independent data requests before awaiting any response', async t => {
  const waiting = new Map()
  t.mock.method(globalThis, 'fetch', url => new Promise(resolve => waiting.set(url, resolve)))
  const result = loadDatasets({ a: '/a.json', b: '/b.json', c: '/c.json' })
  assert.deepEqual([...waiting.keys()], ['/a.json', '/b.json', '/c.json'])
  for (const [url, resolve] of waiting) resolve({ ok: true, json: async () => url })
  assert.deepEqual(await result, { a: '/a.json', b: '/b.json', c: '/c.json' })
})

test('reports the failed data URL rather than accepting an HTTP error page', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 404 }))
  await assert.rejects(fetchJson('/missing.json'), /\/missing.json: HTTP 404/)
})

test('indexed distances agree with every original dataset lookup', () => {
  const distances = JSON.parse(readFileSync(new URL('../data/distances_pzk2tk.json', import.meta.url)))
  const index = buildDistanceIndex(distances)
  for (const [plantzone, towns] of Object.entries(distances)) {
    for (const [town] of towns) {
      assert.equal(index[plantzone].get(Number(town)), towns.find(([key]) => key == town)[1])
    }
  }
  const duplicates = buildDistanceIndex({ 1: [['2', 0], [2, 99]] })
  assert.equal(duplicates[1].get(2), 0)
  assert.equal(duplicates[1].get(3), undefined)
})

test('median worker calculation retains the shipped level-40 default', () => {
  const workers = JSON.parse(readFileSync(new URL('../data/worker_static.json', import.meta.url)))
  assert.deepEqual(medianWorkerStats(workers[7572], 7572, false), {
    level: 40, wspd: 152.05, mspd: 8.41, luck: 12.83, charkey: 7572, isGiant: false,
  })
})

test('coalesces state writes and flushes the latest edit when leaving the page', () => {
  let callback
  let stopped = false
  const writes = []
  const store = {
    $state: { tax: 0.8 },
    $subscribe(fn) { callback = fn; return () => { stopped = true } },
  }
  const persistence = persistStore(store, 'user', { setItem: (...args) => writes.push(args) })
  callback()
  store.$state.tax = 0.9
  callback()
  assert.equal(writes.length, 0)
  persistence.flush()
  assert.deepEqual(writes, [['user', '{"tax":0.9}']])
  store.$state.tax = 0.7
  callback()
  persistence.stop()
  assert.equal(stopped, true)
  assert.equal(writes.length, 2)
  assert.equal(writes[1][1], '{"tax":0.7}')
})
