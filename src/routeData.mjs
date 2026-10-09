const plannerPages = new Set(['/', '/settings', '/workshops', '/housecraft', '/lodging', '/routertests'])
const marketPages = new Set(['/', '/settings', '/plantzones', '/othertowns'])

export function routeDataRequirements(path, user) {
  if (path === '/fishsize') return {}
  if (path === '/about') return { reference: true }
  if (path === '/regionmap') return { language: true }
  const planner = plannerPages.has(path) || (path === '/plantzones' && user.userWorkers.length > 0)
  return {
    core: true, planner, market: marketPages.has(path),
    wasm: path === '/routertests' || (planner && user.wasmRouting),
  }
}

export async function loadRouteData(path, user, game, market) {
  const required = routeDataRequirements(path, user)
  await Promise.all([
    required.core && game.fetchData(),
    required.planner && game.fetchPlannerData(),
    required.reference && game.loadReferenceData(),
    required.language && game.loadLanguage(user.selectedLang),
    required.wasm && game.initWasmRouter().catch(error => {
      if (path === '/routertests') throw error
      user.wasmRouting = false
      console.error('Route planner load failed; using standard routing', error)
    }),
  ])
  if (required.market && !market.apiFetching && market.apiDatetime + 3600000 < Date.now()) {
    // Cached prices can render immediately; network refresh runs in the background.
    market.fetchData().catch(error => console.error('Market refresh failed', error))
  }
}
