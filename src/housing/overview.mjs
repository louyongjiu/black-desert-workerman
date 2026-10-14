import { housingFromPlan } from "./empire.mjs";
import { STORAGE_LIMIT } from "./requirements.mjs";

export function warehouseSlots(stock = {}, itemInfo = {}) {
  const count = (value) =>
    Number.isInteger(Number(value)) && Number(value) > 0
      ? Math.min(STORAGE_LIMIT, Number(value))
      : 0;
  const keys = Object.keys(stock.items || {}).sort(
    (a, b) =>
      (itemInfo[b]?.typePriority || 0) - (itemInfo[a]?.typePriority || 0) ||
      (itemInfo[b]?.grade || 0) - (itemInfo[a]?.grade || 0) ||
      Number(b) - Number(a)
  );
  return [
    ...keys.flatMap((key) => Array(count(stock.items[key])).fill(key)),
    ...Array(count(stock.extra)).fill("W"),
    ...Array(count(stock.personal)).fill("P"),
    ...Array(count(stock.spare)).fill("F"),
  ];
}

export function housingTownKeys(game, plan, workers = {}, warehouses = {}) {
  const townKey = (node) => (game.tnk2tk ? game.tnk2tk(node) : node);
  return [
    ...new Set([
      ...Object.values(game.houseInfo).map((house) => Number(house.affTown)),
      ...(game.townsWithLodging || []).map((node) => Number(townKey(node))),
      ...(game.townsWithRedirectableStorage || []).map((node) =>
        Number(townKey(node))
      ),
      ...(plan?.housing || []).map((house) => Number(house.townKey)),
      ...Object.keys(workers).map(Number),
      ...Object.keys(warehouses).map(Number),
    ]),
  ].filter(Number.isFinite);
}

// Both the single-town and all-town views must use the same saved/preview source.
// A town omitted by a preview has no planned demand, even if it had old workers.
export function empireHousingTown(
  game,
  user,
  key,
  { plan = null, workers = {}, warehouses = {}, infrastructure } = {}
) {
  const empty = {
    success: true,
    cost: 0,
    lodging: 0,
    storage: 0,
    indices: [],
    states: [],
    housingMethod: "lookup",
  };
  let result;
  try {
    const raw = plan
      ? housingFromPlan(plan, key, game, user) || {
          ...empty,
          workerCount: 0,
          storageCount: 0,
        }
      : infrastructure?.(key) || empty;
    result = { ...raw, cost: raw.totalCost ?? raw.cost };
  } catch (error) {
    result = {
      ...empty,
      success: false,
      cost: NaN,
      lodging: NaN,
      storage: NaN,
      error: error.message,
    };
  }
  const demand = {
    workers: result.workerCount ?? workers[key] ?? 0,
    storage: result.storageCount ?? warehouses[key]?.total ?? 0,
    freeBeds: result.baseLodging ?? 1 + Number(user.lodgingP2W?.[key] || 0),
    freeStorage: Math.min(
      STORAGE_LIMIT,
      result.baseStorage ??
        Number(user.baseStorage || 0) + Number(user.storageP2W?.[key] || 0)
    ),
  };
  return {
    key,
    result,
    demand,
    ready: Boolean(
      result.success &&
        !result.pending &&
        !result.error &&
        [result.cost, result.lodging, result.storage].every(Number.isFinite)
    ),
    totalBeds: Number.isFinite(result.lodging)
      ? result.lodging + demand.freeBeds
      : null,
    totalStorage: Number.isFinite(result.storage)
      ? Math.min(STORAGE_LIMIT, result.storage + demand.freeStorage)
      : null,
  };
}

export function summarizeHousing(towns) {
  const sum = (getValue) => {
    const values = towns.map(getValue);
    return values.every(Number.isFinite)
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  const pending = towns.filter((town) => town.result.pending).length;
  const failed = towns.filter(
    (town) => !town.result.pending && !town.ready
  ).length;
  return {
    pending,
    failed,
    cost: pending || failed ? null : sum((town) => town.result.cost),
    workers: sum((town) => town.demand.workers),
    storage: sum((town) => town.demand.storage),
    totalBeds: pending || failed ? null : sum((town) => town.totalBeds),
    totalStorage: pending || failed ? null : sum((town) => town.totalStorage),
  };
}

export function housingRows(game, result, automatic = {}) {
  return (result?.indices || [])
    .map((key, i) => ({
      hk: Number(key),
      house: game.houseInfo[key],
      state: result.states[i],
      usage:
        result.usages?.[i] ??
        (result.states[i] === 1 ? 2 : result.states[i] === 2 ? 1 : 0),
      automatic: Boolean(automatic[key]),
    }))
    .filter((row) => row.house);
}
