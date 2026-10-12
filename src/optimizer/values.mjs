import { repairHousingChoice, townReservations } from "../housing/core.mjs";
import { optimizeSkills, plantzoneProfit } from "./calculations.mjs";
import { connectionCosts } from "./graph.mjs";

export function housingChoices(
  table,
  freeLodging,
  freeStorage,
  maxWorkers,
  maxItems,
  budget
) {
  if (!table) return [];
  const choices = [];
  for (const [capacity, entries] of Object.entries(table)) {
    for (const entry of entries) {
      if (!Number.isFinite(entry.cost) || entry.cost > budget) continue;
      const choice = {
        ...entry,
        lodging: Math.min(maxWorkers, Number(capacity) + freeLodging),
        storage: Math.min(maxItems, entry.storage + freeStorage),
      };
      if (choice.lodging < 0 || choice.storage < 0) continue;
      if (
        choices.some(
          (old) =>
            old.cost <= choice.cost &&
            old.lodging >= choice.lodging &&
            old.storage >= choice.storage
        )
      )
        continue;
      for (let index = choices.length - 1; index >= 0; index--) {
        const old = choices[index];
        if (
          choice.cost <= old.cost &&
          choice.lodging >= old.lodging &&
          choice.storage >= old.storage
        )
          choices.splice(index, 1);
      }
      choices.push(choice);
    }
  }
  return choices.sort(
    (a, b) => a.cost - b.cost || a.lodging - b.lodging || a.storage - b.storage
  );
}

export function prepareValues(snapshot, notify = () => {}) {
  const townKeys = Object.fromEntries(
    Object.values(snapshot.regionInfo)
      .filter((r) => r.waypoint)
      .map((r) => [r.waypoint, r.key])
  );
  const distanceIndexes = Object.fromEntries(
    snapshot.townIds.map((id) => [
      id,
      new Map(
        (snapshot.distances[townKeys[id]] || []).map(([key, value]) => [
          Number(key),
          value,
        ])
      ),
    ])
  );
  const costs = Object.fromEntries(
    snapshot.townIds.map((id) => [
      id,
      connectionCosts(snapshot.nodes, snapshot.links, id),
    ])
  );
  const entries = [],
    missing = [];
  let count = 0;
  for (const [key, drop] of Object.entries(snapshot.drops)) {
    const pzk = Number(key),
      plant = snapshot.plantzones[key];
    if (!plant || !snapshot.links[pzk]) continue;
    const required = new Set(
      Object.entries({ ...drop.unlucky, ...drop.unlucky_gi, ...drop.lucky })
        .filter(([, quantity]) => quantity > 0)
        .map(([item]) => item)
    );
    const unavailable = [...required].filter(
      (item) =>
        snapshot.prices[item] === null ||
        snapshot.prices[item] === "" ||
        !Number.isFinite(Number(snapshot.prices[item])) ||
        Number(snapshot.prices[item]) < 0
    );
    if (unavailable.length) {
      missing.push({ pzk, items: unavailable });
      continue;
    }
    const candidates = [];
    for (const town of snapshot.townIds) {
      const distance = distanceIndexes[town].get(pzk);
      if (
        !Number.isFinite(distance) ||
        distance > 1e6 ||
        costs[town][pzk] === undefined ||
        costs[town][pzk] > snapshot.budget
      )
        continue;
      const workers = snapshot.townTemplates[town].filter(
        (worker) =>
          !plant.species?.length ||
          plant.species.includes(snapshot.workerStatic[worker.charkey].species)
      );
      let best;
      for (const worker of workers) {
        const evaluated = optimizeSkills(
          worker,
          (stats) =>
            plantzoneProfit(
              drop,
              snapshot.prices,
              stats,
              distance,
              snapshot.resources[plant.regiongroup]
            ),
          snapshot.skillData,
          snapshot.workerStatic
        );
        if (
          Number.isFinite(evaluated.value) &&
          evaluated.value > 0 &&
          (!best || evaluated.value > best.value)
        )
          best = evaluated;
      }
      if (best)
        candidates.push({
          pzk,
          town,
          townKey: townKeys[town],
          value: best.value,
          worker: best.worker,
          connectionCost: costs[town][pzk],
          itemKeys: [...required],
        });
    }
    candidates.sort((a, b) => b.value - a.value || a.town - b.town);
    if (candidates.length)
      entries.push({
        pzk,
        candidates: candidates.slice(0, snapshot.candidatesPerPlantzone),
        rank: Math.max(
          ...candidates.map((c) => c.value / Math.max(1, c.connectionCost))
        ),
      });
    if (++count % 25 === 0)
      notify({
        stage: "values",
        completed: count,
        total: Object.keys(snapshot.drops).length,
      });
  }
  entries.sort((a, b) => b.rank - a.rank || a.pzk - b.pzk);
  const candidates = entries
    .slice(0, snapshot.maxPlantzones)
    .flatMap((entry) => entry.candidates);
  const plantzoneIds = [...new Set(candidates.map((c) => c.pzk))];
  const itemKeys = [...new Set(candidates.flatMap((c) => c.itemKeys))];
  const infrastructure = [],
    fixedInfrastructure = [];
  const infrastructureTowns = new Set([
    ...snapshot.townIds,
    ...Object.keys(snapshot.houseReservations || {})
      .map((key) => snapshot.regionInfo[snapshot.houses[key].affTown]?.waypoint)
      .filter(Boolean),
    snapshot.storageTown,
    ...Object.keys(snapshot.storagePersonal)
      .filter((key) => snapshot.storagePersonal[key] > 0)
      .map((key) => snapshot.regionInfo[key]?.waypoint)
      .filter(Boolean),
  ]);
  for (const town of infrastructureTowns) {
    const townKey = townKeys[town];
    const warehouse = town === snapshot.storageTown;
    const workerTown = snapshot.townIds.includes(town);
    const locks = townReservations(
      snapshot.houses || {},
      snapshot.houseReservations || {},
      townKey
    );
    const dynamicHousing = Object.keys(locks).length > 0;
    const freeLodging = 1 + Number(snapshot.lodgingP2W[townKey] || 0);
    const freeStorage =
      snapshot.baseStorage +
      Number(snapshot.storageP2W[townKey] || 0) -
      Number(snapshot.storagePersonal[townKey] || 0);
    let table = snapshot.housing[townKey];
    if (dynamicHousing) {
      const repaired = {};
      for (const [lodging, list] of Object.entries(table || {}))
        for (const old of list) {
          const c = repairHousingChoice(
            snapshot.houses,
            townKey,
            locks,
            old,
            Number(lodging)
          );
          if (c) (repaired[c.lodging] ||= []).push(c);
        }
      table = repaired;
    }
    const choices = housingChoices(
      table,
      1 + Number(snapshot.lodgingP2W[townKey] || 0),
      snapshot.baseStorage +
        Number(snapshot.storageP2W[townKey] || 0) -
        Number(snapshot.storagePersonal[townKey] || 0),
      workerTown ? plantzoneIds.length : 0,
      warehouse ? itemKeys.length + 1 : 0,
      snapshot.budget
    );
    if (!choices.length && !dynamicHousing)
      throw new Error(`城镇 ${town} 的住房或个人仓储需求无法在预算内满足`);
    const entry = {
      town,
      townKey,
      warehouse,
      choices,
      dynamicHousing,
      freeLodging,
      freeStorage,
    };
    if (!workerTown && !warehouse && !dynamicHousing)
      fixedInfrastructure.push({ town, townKey, ...choices[0] });
    else infrastructure.push(entry);
  }
  return {
    candidates,
    plantzoneIds,
    itemKeys,
    infrastructure,
    fixedInfrastructure,
    missing,
    eligiblePlantzones: entries.length,
    consideredPlantzones: plantzoneIds.length,
  };
}
