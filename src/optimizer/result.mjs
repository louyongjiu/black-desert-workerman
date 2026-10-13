import { addedStorage, STORAGE_LIMIT } from "../housing/requirements.mjs";
import { validateFixedPath } from "./fixedWorkshops.mjs";
import { shortestPath } from "./graph.mjs";
import {
  decodeHousing,
  pruneHousing,
  townReservations,
} from "../housing/core.mjs";

export function assertFeasibleColumns(data, columns, tolerance = 1e-5) {
  if (columns.length !== data.numCols)
    throw new Error("求解结果的变量数量不匹配");
  for (let index = 0; index < columns.length; index++) {
    const value = columns[index];
    if (
      !Number.isFinite(value) ||
      value < data.colLower[index] - tolerance ||
      value > data.colUpper[index] + tolerance ||
      (data.integrality[index] &&
        Math.abs(value - Math.round(value)) > tolerance)
    )
      throw new Error("求解结果未满足变量约束");
  }
  const matrix = data.matrix;
  for (let row = 0; row < data.numRows; row++) {
    let value = 0;
    for (
      let entry = matrix.starts[row];
      entry < matrix.starts[row + 1];
      entry++
    )
      value += matrix.values[entry] * columns[matrix.indices[entry]];
    if (
      value < data.rowLower[row] - tolerance ||
      value > data.rowUpper[row] + tolerance
    )
      throw new Error(`求解结果未满足约束 ${row}`);
  }
}

export function decodeResult(problem, columns) {
  assertFeasibleColumns(problem.data, columns);
  const { snapshot, prepared, graph, bases } = problem;
  const selected = new Set(
    [...problem.nodeVars].filter(([, i]) => columns[i] > 0.5).map(([id]) => id)
  );
  const used = new Set(snapshot.fixedNodeIds || []),
    assignments = [],
    grindRoutes = [];
  for (const route of snapshot.fixedWorkshopRoutes || []) {
    validateFixedPath(graph, route.path, route.source, route.target);
    if (route.path.some((id) => !selected.has(id)))
      throw new Error("Retained workshop route is not selected");
    route.path.forEach((id) => used.add(id));
  }
  for (const route of snapshot.fixedActivationRoutes || []) {
    if (route.path.some((id) => !selected.has(id)))
      throw new Error("Retained activation route is not selected");
    route.path.forEach((id) => used.add(id));
  }
  const trace = (source, target) => {
    const path = shortestPath(
      graph.nodes,
      graph.links,
      source,
      target,
      selected
    );
    if (!path) throw new Error(`节点 ${source} 缺少有效的连接路径`);
    path.forEach((id) => used.add(id));
    return path;
  };
  for (const id of problem.locked)
    grindRoutes.push({
      node: id,
      path: trace(id, bases),
      infrastructure: !snapshot.lockedNodeIds.includes(id),
    });
  for (const c of problem.assignments)
    if (columns[c.index] >= 0.5) {
      const a = { ...c };
      delete a.index;
      assignments.push({ ...a, path: trace(c.pzk, c.town) });
    }
  if (
    assignments.some((a) => a.town === 1343) &&
    !problem.locked.includes(1343)
  )
    grindRoutes.push({
      node: 1343,
      path: trace(1343, bases),
      infrastructure: true,
    });
  const itemKeys = [...new Set(assignments.flatMap((a) => a.itemKeys))];
  const housing = [
    ...prepared.infrastructure,
    ...prepared.fixedInfrastructure,
  ].map((town) => {
    const newWorkerCount = assignments.filter(
      (a) => a.town === town.town
    ).length;
    const fixedWorkerCount = town.fixedWorkerCount || 0;
    const added = town.warehouse
      ? addedStorage(town, itemKeys, assignments.length > 0)
      : 0;
    const totalStorage = (town.fixedStorageCount || 0) + added;
    if (town.storageLimit && totalStorage > town.storageLimit)
      throw new Error("Storage demand exceeds the warehouse capacity limit");
    const wantLodging = newWorkerCount - (town.freeLodging || 0),
      wantStorage = added - (town.freeStorage || 0);
    let choice;
    if (town.dynamicHousing) {
      const model = problem.housingModels.find(
        (h) => h.town.town === town.town
      );
      choice = decodeHousing(model, columns, wantLodging, wantStorage);
    } else {
      choice = town.choices
        ? town.choices.find(
            (c) => c.lodging >= newWorkerCount && c.storage >= added
          )
        : town;
      if (!choice) throw new Error(`城镇 ${town.town} 的容量不足`);
    }
    if (snapshot.schemaVersion !== 2)
      return {
        ...choice,
        town: town.town,
        townKey: town.townKey,
        workerCount: newWorkerCount,
        storageCount: added,
      };
    const raw = {
      ...choice,
      lodging: choice.houseLodging ?? choice.lodging,
      storage: choice.houseStorage ?? choice.storage,
      success: true,
      wantLodging,
      wantStorage,
    };
    const locks = townReservations(
      snapshot.houses,
      snapshot.houseReservations,
      town.townKey
    );
    choice = pruneHousing(
      snapshot.houses,
      town.townKey,
      locks,
      raw,
      wantLodging,
      wantStorage
    );
    return {
      ...choice,
      town: town.town,
      townKey: town.townKey,
      dynamicHousing: town.dynamicHousing,
      housingMethod:
        town.housingMethod || (town.dynamicHousing ? "solve" : "lookup"),
      houseLodging: choice.lodging,
      houseStorage: choice.storage,
      reservations: locks,
      workerCount: fixedWorkerCount + newWorkerCount,
      newWorkerCount,
      fixedWorkerCount,
      storageCount: totalStorage,
      fixedStorageCount: town.fixedStorageCount || 0,
      addedStorage: added,
      fixedItems: town.fixedItems || {},
      baseLodging: town.baseLodging,
      baseStorage:
        snapshot.baseStorage + Number(snapshot.storageP2W[town.townKey] || 0),
      totalBedCapacity: choice.lodging + town.baseLodging,
      totalStorageCapacity: Math.min(
        STORAGE_LIMIT,
        choice.storage +
          snapshot.baseStorage +
          Number(snapshot.storageP2W[town.townKey] || 0)
      ),
    };
  });
  const nodeCP = [...used].reduce((n, id) => n + graph.nodes[id].CP, 0),
    infrastructureCP = housing.reduce((n, t) => n + t.cost, 0);
  if (nodeCP + infrastructureCP > snapshot.budget + 1e-5)
    throw new Error("复核后的贡献点成本超过预算");
  const workers = assignments.map((a) => ({
    tnk: a.town,
    charkey: a.worker.charkey,
    label: `优化 ${a.pzk}`,
    level: 40,
    wspdSheet: a.worker.wspd,
    mspdSheet: a.worker.mspd,
    luckSheet: a.worker.luck,
    skills: a.worker.skills,
    job: { kind: "plantzone", pzk: a.pzk, storage: snapshot.storageTown },
  }));
  const fixedProfit = (snapshot.fixedWorkshopRoutes || []).reduce(
    (n, r) => n + (r.profitSilverPerDay || 0),
    0
  );
  const unknownProfit = (snapshot.fixedWorkshopRoutes || []).some(
    (r) => r.profitSilverPerDay === null
  );
  const profitSilverPerDay = assignments.reduce((n, a) => n + a.value, 0);
  const gatheringNodes = new Set(assignments.flatMap((a) => a.path));
  const reusedWorkshopNodeCP = [
    ...new Set((snapshot.fixedWorkshopRoutes || []).flatMap((r) => r.path)),
  ]
    .filter((id) => gatheringNodes.has(id))
    .reduce((n, id) => n + graph.nodes[id].CP, 0);
  return {
    schemaVersion: snapshot.schemaVersion || 1,
    createdAt: snapshot.createdAt,
    sourceSignature: snapshot.sourceSignature,
    valueSignature: snapshot.valueSignature,
    dataSignature: snapshot.dataSignature,
    assignments,
    selectedNodeIds: [...used].sort((a, b) => a - b),
    grindRoutes,
    housing,
    houseReservations: snapshot.houseReservations || {},
    housingDataSignature: snapshot.housingDataSignature,
    workers,
    retainedWorkers: snapshot.retainedWorkers || [],
    previousGatheringCount: snapshot.previousGatheringCount,
    reusedWorkshopNodeCP,
    fixedWorkshopRoutes: snapshot.fixedWorkshopRoutes || [],
    fixedActivationRoutes: snapshot.fixedActivationRoutes || [],
    fixedStorage: snapshot.fixedStorage || {},
    supported: snapshot.supported !== false,
    lockedNodeIds: snapshot.lockedNodeIds,
    storageTown: snapshot.storageTown,
    nodeCP,
    infrastructureCP,
    totalCP: nodeCP + infrastructureCP,
    profitSilverPerDay,
    fixedProfitSilverPerDay: unknownProfit ? null : fixedProfit,
    totalProfitSilverPerDay: unknownProfit
      ? null
      : profitSilverPerDay + fixedProfit,
    optimizationOptions: {
      budget: snapshot.budget,
      timeLimit: snapshot.timeLimit,
      maxPlantzones: snapshot.maxPlantzones,
      townIds: snapshot.townIds,
      storageTown: snapshot.storageTown,
      includeGrind: snapshot.includeGrind ?? snapshot.lockedNodeIds.length > 0,
    },
    budget: snapshot.budget,
    consideredPlantzones: prepared.consideredPlantzones,
    eligiblePlantzones: prepared.eligiblePlantzones,
    missingPrices: prepared.missing,
    priceUpdatedAt: snapshot.priceUpdatedAt,
    modelSize: {
      variables: problem.data.numCols,
      constraints: problem.data.numRows,
    },
    assumptions: [
      "40 级平均属性工人，按采集点搜索九项技能候选",
      "Workshop and idle workers are retained; gathering uses average level-40 workers",
    ],
  };
}
