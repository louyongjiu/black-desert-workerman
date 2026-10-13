import { captureFixedWorkshops, supportedEmpire } from "./fixedWorkshops.mjs";
import { stable, planningDataSignature } from "../housing/requirements.mjs";
import {
  normalizeReservations,
  housingDataSignature,
} from "../housing/core.mjs";
const plain = (value) => JSON.parse(JSON.stringify(value));

export function configurationSignature(user) {
  const numericMap = (value = {}) =>
    Object.entries(value)
      .filter(([, v]) => Number(v) !== 0)
      .map(([key, v]) => [Number(key), Number(v)])
      .sort((a, b) => a[0] - b[0]);
  const fields = [
    user.userWorkers,
    user.grindTakenList,
    numericMap(user.lodgingP2W),
    numericMap(user.storageP2W),
    numericMap(user.storagePersonal),
    user.storageVP,
    user.selectedRegion,
    user.activateAncado,
    user.farmingEnable,
    user.tradeDestinations,
    user.tradeRouteAlwaysOn,
    user.tradeInfraCp,
    user.tradeRouteCp,
  ];
  const reservations = Object.entries(user.houseReservations || {}).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );
  // Empty new settings preserve signatures of previously applied gathering plans.
  if (reservations.length) fields.push(reservations);
  if (user.palaceEnable) fields.push({ palaceEnable: true });
  const storage = Object.entries(user.workshopStorage || {});
  if (storage.length) fields.push(stable(user.workshopStorage));
  if ((user.userWorkers || []).some((w) => w.job?.kind === "workshop"))
    fields.push(stable([user.wasmRouting, user.linkOrder, user.wasm]));
  return JSON.stringify(fields);
}

export function valuationSignature(user, market) {
  const fields = [
    market.prices,
    user.regionResources,
    user.allowFloating,
    user.useFloatingResources,
    user.regionResources2,
  ];
  if ((user.userWorkers || []).some((w) => w.job?.kind === "workshop"))
    fields.push(
      stable(
        Object.fromEntries(
          user.userWorkers
            .filter((w) => w.job?.kind === "workshop")
            .map((w) => {
              const c =
                user.userWorkshops?.[w.job.hk] ||
                user.defaultUserWorkshop ||
                {};
              return [
                w.job.hk,
                [c.industry, c.manualWorkload, c.manualCycleIncome],
              ];
            })
        )
      )
    );
  return JSON.stringify(fields);
}

export function createSnapshot(game, user, market, options, routing) {
  if (!game.ready || !game.plannerReady)
    throw new Error("游戏与住房数据尚未加载完成");
  const budget = Number(options.budget),
    timeLimit = Number(options.timeLimit),
    maxPlantzones = Number(options.maxPlantzones);
  if (!Number.isFinite(budget) || budget < 0 || budget > 2000)
    throw new Error("贡献点预算需在 0–2000 之间");
  if (!Number.isFinite(timeLimit) || timeLimit < 1 || timeLimit > 300)
    throw new Error("计算上限需在 1–300 秒之间");
  if (
    !Number.isInteger(maxPlantzones) ||
    maxPlantzones < 1 ||
    maxPlantzones > 370
  )
    throw new Error("采集点候选数量需在 1–370 之间");
  const townIds = [...new Set(options.townIds.map(Number))];
  if (
    !townIds.length ||
    townIds.some((id) => !game.townsWithLodging.includes(id))
  )
    throw new Error("请选择有效的工人城镇");
  const storageTown = Number(options.storageTown);
  if (!game.townsWithRedirectableStorage.includes(storageTown))
    throw new Error("请选择有效的产物仓库");
  const townTemplates = Object.fromEntries(
    townIds.map((id) => [
      id,
      [game.medianGoblin(id), game.medianGiant(id), game.medianHuman(id)],
    ])
  );
  const resources = Object.fromEntries(
    Object.keys(game.regionGroups).map((key) => [
      key,
      {
        productivity: user.productivity(key),
        floating: Boolean(user.allowFloating && user.useFloatingResources[key]),
        times: user.modTimes[key],
      },
    ])
  );
  const fixed = captureFixedWorkshops(game, user, routing);
  const snapshot = plain({
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    nodes: game.nodes,
    links: game.links,
    drops: game.plantzoneDrops,
    plantzones: game.plantzoneStatic,
    distances: game.tk2pzk,
    regionInfo: game.regionInfo,
    housing: game.ls_lookup,
    houses: game.houseInfo,
    housingDataSignature: housingDataSignature(game.houseInfo),
    houseReservations: normalizeReservations(game.houseInfo, user),
    dataSignature: planningDataSignature(game),
    retainedWorkers: fixed.workers,
    previousGatheringCount: user.userWorkers.length - fixed.workers.length,
    fixedWorkshopRoutes: fixed.routes,
    fixedActivationRoutes: fixed.activationRoutes,
    fixedNodeIds: fixed.nodes,
    fixedWorkerCounts: fixed.counts,
    fixedStorage: fixed.storage,
    supported: supportedEmpire(user),
    workerStatic: game.workerStatic,
    skillData: game.skillData,
    townTemplates,
    resources,
    prices: market.prices,
    priceUpdatedAt: market.apiDatetime,
    selectedRegion: user.selectedRegion,
    lodgingP2W: user.lodgingP2W,
    storageP2W: user.storageP2W,
    storagePersonal: user.storagePersonal,
    baseStorage: user.baseStorage,
    lockedNodeIds: options.includeGrind ? user.grindTakenList.map(Number) : [],
    activateAncado: user.activateAncado,
    budget,
    timeLimit,
    maxPlantzones,
    includeGrind: Boolean(options.includeGrind),
    townIds,
    storageTown,
    candidatesPerPlantzone: Math.min(6, townIds.length),
  });
  snapshot.sourceSignature = configurationSignature(user);
  snapshot.valueSignature = valuationSignature(user, market);
  return snapshot;
}

export function canReplaceGatheringWorkers(user) {
  return supportedEmpire(user);
}
