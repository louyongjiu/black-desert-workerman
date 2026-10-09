import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import init, { WasmNodeRouter } from '../src/pkg/noderouter.js'

await init({ module_or_path: readFileSync(new URL('../src/pkg/noderouter_bg.wasm', import.meta.url)) })

const sharedGraph = Object.fromEntries([
  [1, 0, [2, 3]],
  [2, 1, [1, 4, 5]],
  [3, 3, [1, 4]],
  [4, 1, [2, 3]],
  [5, 1, [2]],
].map(([key, cost, links]) => [key, {
  waypoint_key: key, need_exploration_point: cost,
  is_base_town: key === 1, link_list: links,
}]))

function assertRoutes(graph, pairs, [activated, cost]) {
  const selected = new Set(activated)
  assert.equal(selected.size, activated.length, 'selected nodes must be unique')
  for (const node of selected) assert.ok(graph[node], `unknown selected node ${node}`)
  assert.equal(cost, activated.reduce((sum, node) => sum + graph[node].need_exploration_point, 0))
  for (const [terminal, root] of pairs) {
    const visited = new Set([terminal])
    const pending = [terminal]
    assert.ok(selected.has(terminal), `missing terminal ${terminal}`)
    while (pending.length) {
      const node = pending.pop()
      for (const neighbor of graph[node].link_list) {
        if (selected.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor)
          pending.push(neighbor)
        }
      }
    }
    assert.ok(root === 99999
      ? [...visited].some(node => graph[node].is_base_town)
      : visited.has(root), `disconnected route ${terminal} -> ${root}`)
  }
}

test('official JS and WASM share routes and count each contribution cost once', () => {
  const router = new WasmNodeRouter(sharedGraph)
  try {
    const pairs = [[4, 1], [5, 1]]
    const result = router.solveForTerminalPairs(pairs)
    assertRoutes(sharedGraph, pairs, result)
    assert.deepEqual(result, [[1, 2, 4, 5], 3])
    assert.deepEqual(router.solveForTerminalPairs([]), [[], 0])
  } finally {
    router.free()
  }
})

test('super-root routing, frontier options and repeated solves retain valid routes', () => {
  const router = new WasmNodeRouter(sharedGraph)
  try {
    const pairs = [[4, 99999], [5, 1]]
    for (const rings of ['3', '5', '3']) {
      router.setOption('max_frontier_rings', rings)
      const result = router.solveForTerminalPairs(pairs)
      assertRoutes(sharedGraph, pairs, result)
      assert.equal(result[1], 3)
    }
    assertRoutes(sharedGraph, [[4, 1]], router.solveForTerminalPairs([[4, 1]]))
  } finally {
    router.free()
  }
})

test('real game graph supports worker, grinding, Ancado and wagon routes', () => {
  const readData = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url)))
  const nodes = readData('exploration')
  const links = readData('links')
  const graph = Object.fromEntries(Object.entries(links).map(([key, link_list]) => {
    const node = nodes[key]
    return [key, {
      link_list, waypoint_key: node.key, need_exploration_point: node.CP,
      is_base_town: node.kind > 0 && node.kind < 3 && node.CP === 0,
    }]
  }))
  const towns = Object.values(graph).filter(node => node.is_base_town).map(node => node.waypoint_key)
  const plantzones = Object.keys(readData('plantzone')).map(Number).filter(key => graph[key])
  const workerPairs = Array.from({ length: 8 }, (_, index) => [
    plantzones[Math.floor(index * plantzones.length / 8)], towns[index % towns.length],
  ])
  const pairs = [...workerPairs, [1343, 99999], [towns.at(-1), towns[0]]]
  const router = new WasmNodeRouter(graph)
  try {
    assertRoutes(graph, pairs, router.solveForTerminalPairs(pairs))
    router.setOption('max_frontier_rings', '5')
    assertRoutes(graph, pairs, router.solveForTerminalPairs(pairs))
    router.setOption('max_frontier_rings', '3')
    assertRoutes(graph, pairs, router.solveForTerminalPairs(pairs))
  } finally {
    router.free()
  }
})
