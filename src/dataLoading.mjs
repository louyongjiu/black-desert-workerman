import { resourceManifest, resourceUrl } from './resourceUrls.mjs'

export const CORE_DATASETS = {
  plantzoneDrops: 'data/manual/plantzone_drops.json',
  plantzoneStatic: 'data/plantzone.json',
  itemInfo: 'data/item_info.json',
  itemKeys: 'data/manual/plantzone_uniques.json',
  nodes: 'data/exploration.json',
  tk2pzk: 'data/distances_tk2pzk.json',
  pzk2tk: 'data/distances_pzk2tk.json',
  regionInfo: 'data/regioninfo.json',
  vendorPrices: 'data/manual/vendor_prices.json',
  skillData: 'data/manual/skills.json',
  workerStatic: 'data/worker_static.json',
  links: 'data/links.json',
  craftInputs: 'data/house_craft_inputs.json',
}

export const PLANNER_DATASETS = {
  tk2hk: 'data/distances_tk2hk.json',
  lodgingPerTown: 'data/lodging_per_town.json',
  houseInfo: 'data/houseinfo.json',
  ls_lookup: 'data/all_lodging_storage.json',
  craftOutputs: 'data/house_craft_outputs.json',
  craftInfo: 'data/house_craft_info.json',
}

export const DATASET_GROUPS = { core: CORE_DATASETS, planner: PLANNER_DATASETS }
export const GAME_DATASETS = { ...CORE_DATASETS, ...PLANNER_DATASETS }

export async function fetchJson(url, options) {
  const response = await fetch(resourceUrl(url), options)
  if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status}`)
  return response.json()
}

export function loadGameDatasets(group) {
  if (!DATASET_GROUPS[group]) throw new Error(`Unknown game dataset group: ${group}`)
  const bundle = `data/game-${group}.json`
  return resourceManifest[bundle] ? fetchJson(bundle) : loadDatasets(DATASET_GROUPS[group])
}

export async function loadDatasets(datasets, options) {
  const entries = await Promise.all(Object.entries(datasets).map(async ([key, url]) =>
    [key, await fetchJson(url, options)],
  ))
  return Object.fromEntries(entries)
}
