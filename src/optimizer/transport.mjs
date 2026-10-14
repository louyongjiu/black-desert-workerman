import { DATASET_GROUPS, fetchJson } from "../dataLoading.mjs";
import { resourceManifest, resourceUrl } from "../resourceUrls.mjs";
import { planningDataSignature } from "../housing/requirements.mjs";
import { housingDataSignature } from "../housing/core.mjs";
import { createPreparationCache } from "./values.mjs";

export const STATIC_SNAPSHOT_FIELDS = [
  "nodes",
  "links",
  "drops",
  "plantzones",
  "distances",
  "regionInfo",
  "housing",
  "houses",
  "workerStatic",
  "skillData",
  "housingDataSignature",
];

export function optimizerResources() {
  return Object.fromEntries(
    Object.entries(DATASET_GROUPS).map(([group, datasets]) => {
      const bundle = `data/game-${group}.json`;
      return [
        group,
        resourceManifest[bundle]
          ? resourceUrl(bundle)
          : Object.fromEntries(
              Object.entries(datasets).map(([key, path]) => [
                key,
                resourceUrl(path),
              ])
            ),
      ];
    })
  );
}

export async function loadOptimizerData(resources) {
  const groups = await Promise.all(
    Object.values(resources).map((group) =>
      typeof group === "string"
        ? fetchJson(group)
        : Promise.all(
            Object.entries(group).map(async ([key, url]) => [
              key,
              await fetchJson(url),
            ])
          ).then(Object.fromEntries)
    )
  );
  const game = Object.assign({}, ...groups);
  return {
    nodes: game.nodes,
    links: game.links,
    drops: game.plantzoneDrops,
    plantzones: game.plantzoneStatic,
    distances: game.tk2pzk,
    regionInfo: game.regionInfo,
    housing: game.ls_lookup,
    houses: game.houseInfo,
    workerStatic: game.workerStatic,
    skillData: game.skillData,
    housingDataSignature: housingDataSignature(game.houseInfo),
    dataSignature: planningDataSignature(game),
  };
}

// One session belongs to one serial Worker. Static geometry, WASM and bounded
// valuation caches survive successful solves; terminating the Worker releases all.
export function optimizerSession(
  loadSolver,
  solve,
  loadData = loadOptimizerData
) {
  let solver;
  let version;
  let data;
  const cache = createPreparationCache();
  return async (input, emit) => {
    let snapshot = input;
    if (input.transport === 1) {
      if (version !== input.dataVersion) {
        const loaded = await loadData(input.resources);
        if (loaded.dataSignature !== input.dataVersion)
          throw new Error(
            "Game data changed; reload this page before optimizing"
          );
        data = loaded;
        version = input.dataVersion;
      }
      snapshot = { ...data, ...input.params };
    }
    solver ||= Promise.resolve()
      .then(loadSolver)
      .catch((error) => {
        solver = null;
        throw error;
      });
    return solve(await solver, snapshot, emit, cache);
  };
}
