import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { DATASET_GROUPS } from '../src/dataLoading.mjs'

function gameHarness(loadGroup, proxyActions = false) {
  const source = readFileSync(new URL('../src/stores/game.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace('export const useGameStore =', 'const useGameStore =')
  const options = vm.runInNewContext(source + '\nuseGameStore', {
    defineStore: options => options, markRaw: value => value,
    useUserStore: () => ({ selectedLang: 'en' }),
    console: { log() {} }, loadGameDatasets: loadGroup,
    fetchJson: async file => JSON.parse(readFileSync(new URL('../' + file, import.meta.url))),
  })
  const state = { ...options.state(), $patch(fn) { fn(this) } }
  Object.defineProperty(state, '$state', { get: () => state })
  for (const [name, fn] of Object.entries(options.actions)) state[name] = fn.bind(state)
  if (proxyActions) {
    const facade = () => new Proxy(state, {
      get(target, name, receiver) {
        if (name in options.actions) return (...args) => options.actions[name].apply(facade(), args)
        return Reflect.get(target, name, receiver)
      },
    })
    return facade()
  }
  return state
}

function originalGroup(group) {
  return Object.fromEntries(Object.entries(DATASET_GROUPS[group]).map(([key, file]) =>
    [key, JSON.parse(readFileSync(new URL('../' + file, import.meta.url)))],
  ))
}

test('concurrent core and planner requests coalesce, and core loading never initializes WASM', async () => {
  const calls = []
  const game = gameHarness(async group => { calls.push(group); return originalGroup(group) })
  await Promise.all([game.fetchData(), game.fetchData()])
  assert.deepEqual(calls, ['core'])
  assert.equal(game.ready, true)
  assert.equal(game.plannerReady, false)
  assert.equal(game.wasmRouter, null)
  assert.equal(Object.keys(game.ls_lookup).length, 0)
  await Promise.all([game.fetchPlannerData(), game.fetchPlannerData()])
  assert.deepEqual(calls, ['core', 'planner'])
  assert.equal(game.plannerReady, true)
  assert.ok(Object.keys(game.ls_lodgings_sorted).length > 0)
  await game.fetchPlannerData()
  assert.deepEqual(calls, ['core', 'planner'])
})

test('request coalescing survives a different store proxy for every nested Pinia action', async () => {
  const calls = []
  const game = gameHarness(async group => { calls.push(group); return originalGroup(group) }, true)
  await Promise.all([game.fetchData(), game.fetchPlannerData(), game.fetchData()])
  assert.deepEqual(calls, ['core', 'planner'])
  assert.equal(game.ready, true)
  assert.equal(game.plannerReady, true)
})

test('failed data and WASM loads can be retried without stuck loading flags', async () => {
  let fail = true
  const game = gameHarness(async group => {
    if (fail) throw new Error('Network failed')
    return originalGroup(group)
  })
  await assert.rejects(game.fetchData(), /Network failed/)
  assert.equal(game.ready, false)
  fail = false
  await game.fetchData()
  assert.equal(game.ready, true)
  let wasmLoads = 0
  game.loadWasmRouter = async () => { wasmLoads++; throw new Error('WASM failed') }
  await assert.rejects(game.initWasmRouter(), /WASM failed/)
  assert.equal(game.wasmLoading, false)
  assert.ok(game.wasmError)
  game.loadWasmRouter = async () => { wasmLoads++; game.wasmRouter = {} }
  await Promise.all([game.initWasmRouter(), game.initWasmRouter()])
  assert.equal(game.wasmLoading, false)
  assert.equal(game.wasmError, '')
  assert.equal(wasmLoads, 2)
})
