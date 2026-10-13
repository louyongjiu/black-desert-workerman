import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { localizeGameLanguage } from "../src/i18n/game.mjs";
import {
  normalizeReservations,
  housingDataSignature,
} from "../src/housing/core.mjs";
import { solveHousing } from "../src/housing/solve.mjs";
import {
  employeeCounts,
  storageRequirements,
} from "../src/housing/requirements.mjs";
import { validAppliedPlan, housingFromPlan } from "../src/housing/empire.mjs";
import { mergeEmpire } from "../src/optimizer/application.mjs";
import { connectionTree, treePath } from "../src/optimizer/graph.mjs";
import vm from "node:vm";
import loadHighs from "highs";
import { buildModel } from "../src/optimizer/model.mjs";
import { greedySeed } from "../src/optimizer/seed.mjs";
import { prepareValues } from "../src/optimizer/values.mjs";
import { decodeResult } from "../src/optimizer/result.mjs";
import {
  cyclesDaily,
  plantzoneProfit,
} from "../src/optimizer/calculations.mjs";
import { solveSnapshot } from "../src/optimizer/solve.mjs";
import {
  createSnapshot,
  configurationSignature,
} from "../src/optimizer/snapshot.mjs";
import { shortestPath } from "../src/optimizer/graph.mjs";
import { appliedRouting } from "../src/optimizer/appliedRouting.mjs";
import { OptimizerClient } from "../src/optimizer/client.mjs";
import { DATASET_GROUPS } from "../src/dataLoading.mjs";
import { buildDistanceIndex, medianWorkerStats } from "../src/gameLookups.mjs";
import { binarySearch } from "../src/util.js";

const highs = await loadHighs();
test("empty reservations preserve the legacy configuration signature; reserving a house invalidates it", () => {
  const user = {
    userWorkers: [],
    grindTakenList: [],
    lodgingP2W: { 5: 0 },
    storageP2W: {},
    storagePersonal: {},
    storageVP: false,
    selectedRegion: "RU",
    activateAncado: false,
    farmingEnable: false,
    tradeDestinations: {},
    tradeRouteAlwaysOn: {},
    tradeInfraCp: {},
    tradeRouteCp: {},
  };
  const legacy = JSON.stringify([
    [],
    [],
    [],
    [],
    [],
    false,
    "RU",
    false,
    false,
    {},
    {},
    {},
    {},
  ]);
  assert.equal(configurationSignature(user), legacy);
  user.houseReservations = {};
  assert.equal(configurationSignature(user), legacy);
  user.houseReservations = { 2112: { usage: 0 } };
  assert.notEqual(configurationSignature(user), legacy);
});

function fixture(budget, lockedNodeIds = []) {
  const nodes = Object.fromEntries(
    [
      [1, 0, 2],
      [2, 2, 0],
      [3, 1, 9],
      [4, 1, 9],
      [5, 3, 0],
      [6, 0, 2],
      [8, 2, 0],
    ].map(([key, CP, kind]) => [key, { key, CP, kind }])
  );
  const links = {
    1: [2],
    2: [1, 3, 4, 5],
    3: [2],
    4: [2],
    5: [2, 6, 8],
    6: [5],
    8: [5],
  };
  const worker = { charkey: 1, wspd: 100, mspd: 10, luck: 10, skills: [] };
  const snapshot = {
    nodes,
    links,
    budget,
    townIds: [1, 6],
    storageTown: 1,
    lockedNodeIds,
    sourceSignature: "fixture",
    createdAt: "fixture",
  };
  const prepared = {
    candidates: [
      { pzk: 3, town: 1, value: 10e6, itemKeys: ["a"], worker },
      { pzk: 3, town: 6, value: 8e6, itemKeys: ["a"], worker },
      { pzk: 4, town: 1, value: 7e6, itemKeys: ["b"], worker },
      { pzk: 4, town: 6, value: 9e6, itemKeys: ["b"], worker },
    ],
    plantzoneIds: [3, 4],
    itemKeys: ["a", "b"],
    infrastructure: [
      {
        town: 1,
        warehouse: true,
        choices: [
          { lodging: 1, storage: 1, cost: 0 },
          { lodging: 2, storage: 1, cost: 1 },
          { lodging: 1, storage: 3, cost: 2 },
          { lodging: 2, storage: 3, cost: 2 },
        ],
      },
      {
        town: 6,
        warehouse: false,
        choices: [
          { lodging: 1, storage: 0, cost: 0 },
          { lodging: 2, storage: 0, cost: 2 },
        ],
      },
    ],
    fixedInfrastructure: [],
    missing: [],
    consideredPlantzones: 2,
    eligiblePlantzones: 2,
  };
  return { snapshot, prepared };
}

function bruteForce(snapshot, prepared) {
  let best = -Infinity;
  const paid = Object.values(snapshot.nodes)
    .filter((n) => n.CP > 0)
    .map((n) => n.key);
  for (let mask = 0; mask < 2 ** paid.length; mask++) {
    const selected = new Set([
      1,
      6,
      ...paid.filter((_, index) => mask & (2 ** index)),
    ]);
    if (
      snapshot.lockedNodeIds.some(
        (id) =>
          !shortestPath(
            snapshot.nodes,
            snapshot.links,
            id,
            new Set([1, 6]),
            selected
          )
      )
    )
      continue;
    const nodeCP = [...selected].reduce(
      (sum, id) => sum + snapshot.nodes[id].CP,
      0
    );
    for (const first of [
      null,
      ...prepared.candidates.filter((a) => a.pzk === 3),
    ]) {
      for (const second of [
        null,
        ...prepared.candidates.filter((a) => a.pzk === 4),
      ]) {
        const chosen = [first, second].filter(Boolean);
        if (
          chosen.some(
            (a) =>
              !shortestPath(
                snapshot.nodes,
                snapshot.links,
                a.pzk,
                a.town,
                selected
              )
          )
        )
          continue;
        const itemCount =
          new Set(chosen.flatMap((a) => a.itemKeys)).size +
          (chosen.length ? 1 : 0);
        let cost = nodeCP;
        for (const town of prepared.infrastructure) {
          const count = chosen.filter((a) => a.town === town.town).length;
          const options = town.choices.filter(
            (c) =>
              c.lodging >= count && (!town.warehouse || c.storage >= itemCount)
          );
          cost += options.length
            ? Math.min(...options.map((c) => c.cost))
            : Infinity;
        }
        if (cost <= snapshot.budget)
          best = Math.max(
            best,
            chosen.reduce((sum, a) => sum + a.value, 0)
          );
      }
    }
  }
  return best;
}

test("joint flow, shared CP, housing and warehouse model agrees with exhaustive enumeration", () => {
  for (const locked of [[], [8]])
    for (const budget of [0, 3, 5, 6, 8, 12]) {
      const { snapshot, prepared } = fixture(budget, locked);
      const problem = buildModel(snapshot, prepared),
        expected = bruteForce(snapshot, prepared);
      const model = highs.createModel(problem.data);
      try {
        const seed = greedySeed(problem);
        if (seed) {
          const decoded = decodeResult(problem, seed);
          assert.ok(decoded.profitSilverPerDay <= expected);
          model.setSolution({ colValue: seed });
        }
        model.options.set({ output_flag: false, mip_rel_gap: 0 });
        model.run();
        if (!Number.isFinite(expected)) {
          assert.equal(
            model.getModelStatus(),
            highs.constants.modelStatus.infeasible
          );
          continue;
        }
        assert.equal(
          model.getModelStatus(),
          highs.constants.modelStatus.optimal
        );
        const result = decodeResult(problem, model.getSolution().colValue);
        assert.equal(
          result.profitSilverPerDay,
          expected,
          `budget ${budget}, fixed ${locked}`
        );
        assert.ok(result.totalCP <= budget);
        assert.equal(
          new Set(result.assignments.map((a) => a.pzk)).size,
          result.assignments.length
        );
      } finally {
        model.dispose();
      }
    }
});

test("independent result validation rejects fractional choices and unreachable or overspent solutions", () => {
  const { snapshot, prepared } = fixture(6),
    problem = buildModel(snapshot, prepared);
  const model = highs.createModel(problem.data);
  try {
    model.options.set({ output_flag: false });
    model.run();
    const columns = model.getSolution().colValue;
    const corrupt = Float64Array.from(columns);
    corrupt[problem.assignments[0].index] = 0.5;
    assert.throws(() => decodeResult(problem, corrupt), /变量约束/);
    assert.throws(
      () =>
        decodeResult(
          { ...problem, snapshot: { ...snapshot, budget: 0 } },
          columns
        ),
      /超过预算/
    );
    assert.throws(
      () =>
        decodeResult(
          { ...problem, graph: { ...problem.graph, links: {} } },
          columns
        ),
      /连接路径/
    );
  } finally {
    model.dispose();
  }
});

test("static and floating resource cycles match known breakpoints and interpolated resource distribution", () => {
  assert.equal(
    cyclesDaily(200, 150, 600, 10, { productivity: 0.5 }),
    1440 / 22
  );
  const resource = { floating: true, times: { 0: 100, 50: 50, 100: 0 } };
  // Speed 150 crosses work tiers at resource 50% and below; the frontend's
  // workload flooring retains its existing two-tier expectation.
  const expected = (1440 * 0.5) / (20 + 2) + (1440 * 0.5) / (30 + 2);
  assert.equal(cyclesDaily(200, 150, 600, 10, resource), expected);
  assert.equal(
    plantzoneProfit(
      { workload: 200, unlucky: { a: 2 }, lucky: { b: 1 } },
      { a: 100, b: 1000 },
      { wspd: 150, mspd: 10, luck: 10, isGiant: false },
      600,
      { productivity: 0.5 }
    ),
    (300 * 1440) / 22
  );
});

test("worker cancellation ignores stale events and preserves the last received feasible plan", () => {
  const workers = [],
    events = [];
  const client = new OptimizerClient(
    () => {
      const worker = {
        terminate() {
          this.terminated = true;
        },
        postMessage(value) {
          this.input = value;
        },
      };
      workers.push(worker);
      return worker;
    },
    (event) => events.push(event)
  );
  client.start({ budget: 1 });
  const old = workers[0];
  old.onmessage({ data: { type: "solution", result: { value: 1 } } });
  client.stop();
  old.onmessage({ data: { type: "complete", result: { value: 999 } } });
  assert.deepEqual(
    events.map((e) => e.type),
    ["solution", "stopped"]
  );
  assert.ok(old.terminated);
  client.start({ budget: 2 });
  old.onmessage({ data: { type: "error" } });
  workers[1].onmessage({ data: { type: "complete", result: { value: 2 } } });
  assert.equal(events.at(-1).result.value, 2);
  assert.ok(workers[1].terminated);
});

function realGame() {
  const readData = (file) =>
    JSON.parse(readFileSync(new URL("../" + file, import.meta.url)));
  let game, user;
  const userSource = readFileSync(
    new URL("../src/stores/user.js", import.meta.url),
    "utf8"
  )
    .replace(/^import .*\r?\n/gm, "")
    .replace("export const useUserStore =", "const useUserStore =");
  const userOptions = vm.runInNewContext(userSource + "\nuseUserStore", {
    defineStore: (value) => value,
    useGameStore: () => game,
    useRoutingStore: () => ({ routing: appliedRouting(user, game) }),
    calculateCyclesDaily: cyclesDaily,
    configurationSignature,
    normalizeReservations,
    housingDataSignature,
    employeeCounts,
    storageRequirements,
    validAppliedPlan,
    useHousingStore: () => ({
      lookup(tk, l, s) {
        if (validAppliedPlan(user, game)) {
          const plan = housingFromPlan(user.optimizerPlan, tk);
          if (
            plan &&
            Math.max(0, plan.wantLodging) === Math.max(0, l) &&
            Math.max(0, plan.wantStorage) === Math.max(0, s)
          )
            return plan;
        }
        const reservations = normalizeReservations(game.houseInfo, user);
        if (
          !Object.keys(reservations).some(
            (hk) => game.houseInfo[hk].affTown == tk
          )
        )
          return game.lsLookup(tk, l, s);
        return solveHousing(highs, {
          houses: game.houseInfo,
          townKey: tk,
          reservations,
          wantLodging: l,
          wantStorage: s,
          key: "harness",
          timeLimit: 3,
        });
      },
    }),
    console: { log() {} },
  });
  user = { ...userOptions.state(), selectedLang: "en" };
  const bind = (object, options) => {
    for (const [key, fn] of Object.entries(options.actions))
      object[key] = fn.bind(object);
    for (const [key, fn] of Object.entries(options.getters))
      Object.defineProperty(object, key, {
        get: () => fn.call(object, object),
      });
  };
  bind(user, userOptions);
  const prices = Object.fromEntries(
    Object.values(readData("data/manual/plantzone_drops.json")).flatMap(
      (drop) =>
        Object.keys({ ...drop.unlucky, ...drop.unlucky_gi, ...drop.lucky }).map(
          (key) => [key, 1000]
        )
    )
  );
  const market = {
    prices,
    apiDatetime: 0,
    priceBunch: (bunch) => ({
      val: Object.entries(bunch || {}).reduce(
        (sum, [key, q]) => sum + prices[key] * q,
        0
      ),
    }),
    priceLerp: (lucky, unlucky, luck) =>
      lucky === null
        ? unlucky
        : (luck / 100) * lucky + (1 - luck / 100) * unlucky,
  };
  const gameSource = readFileSync(
    new URL("../src/stores/game.js", import.meta.url),
    "utf8"
  )
    .replace(/^import .*\r?\n/gm, "")
    .replace("export const useGameStore =", "const useGameStore =");
  const gameOptions = vm.runInNewContext(gameSource + "\nuseGameStore", {
    localizeGameLanguage,
    defineStore: (value) => value,
    markRaw: (value) => value,
    useUserStore: () => user,
    useMarketStore: () => market,
    buildDistanceIndex,
    medianWorkerStats,
    binarySearch,
    console: { log() {} },
    fetchJson: async (file) => readData(file),
    loadGameDatasets: async (group) =>
      Object.fromEntries(
        Object.entries(DATASET_GROUPS[group]).map(([key, file]) => [
          key,
          readData(file),
        ])
      ),
  });
  game = {
    ...gameOptions.state(),
    $patch(fn) {
      fn(this);
    },
  };
  Object.defineProperty(game, "$state", { get: () => game });
  bind(game, gameOptions);
  return { game, user, market };
}

test("real game candidates and applied paths reproduce the current UI profit and CP accounting", async () => {
  const { game, user, market } = realGame();
  await game.fetchPlannerData();
  const snapshot = createSnapshot(game, user, market, {
    townIds: [1],
    budget: 80,
    timeLimit: 8,
    maxPlantzones: 20,
    storageTown: 601,
    includeGrind: true,
  });
  const prepared = prepareValues(snapshot);
  assert.equal(prepared.consideredPlantzones, 20);
  assert.equal(prepared.missing.length, 0);
  const events = [],
    result = solveSnapshot(highs, snapshot, (event) => events.push(event));
  assert.ok(result.assignments.length);
  assert.ok(result.totalCP <= 80);
  assert.ok(events.some((event) => event.type === "solution"));
  let profit = 0;
  for (const worker of result.workers) {
    const stats = game.workerStatsOnPlantzone(worker);
    profit +=
      game.profitPzTownStats(
        worker.job.pzk,
        worker.tnk,
        stats.wspd,
        stats.mspd,
        stats.luck,
        game.isGiant(worker.charkey)
      ).priceDaily * 1e6;
  }
  assert.ok(Math.abs(profit - result.profitSilverPerDay) < 1e-5);
  user.userWorkers = result.workers;
  const plan = { ...result, appliedSignature: configurationSignature(user) };
  user.optimizerPlan = plan;
  const routed = appliedRouting(user, game);
  assert.equal(routed.autotakenNodesCP, result.nodeCP);
  assert.equal(
    Object.keys(routed.pzWsJobs.pz).length,
    result.assignments.length
  );
  assert.equal(user.totalCP, result.totalCP);
  assert.ok(
    appliedRouting(user, game),
    "default zero-valued infrastructure entries must not invalidate saved paths"
  );
  user.userWorkers[0].tnk = 301;
  assert.equal(appliedRouting(user, game), null);
});

test("reserved houses join the empire model, seed remains valid, application reproduces CP and reservation changes invalidate paths", async () => {
  const { game, user, market } = realGame();
  await game.fetchPlannerData();
  const locked = Object.values(game.houseInfo).find(
    (h) => h.affTown === 5 && h.CraftList[1] >= 2
  );
  const outside = Object.values(game.houseInfo).find(
    (h) => h.affTown === 88 && h.CraftList[0]
  );
  user.houseReservations = {
    [locked.key]: { usage: 0 },
    [outside.key]: { usage: 0 },
  };
  const snapshot = createSnapshot(game, user, market, {
    townIds: [1],
    budget: 80,
    timeLimit: 8,
    maxPlantzones: 20,
    storageTown: 601,
    includeGrind: true,
  });
  const prepared = prepareValues(snapshot),
    problem = buildModel(snapshot, prepared);
  assert.equal(problem.housingModels.length, 2);
  const seed = greedySeed(problem);
  assert.ok(seed);
  decodeResult(problem, seed);
  const result = solveSnapshot(highs, snapshot);
  assert.ok(result.workers.length);
  const room = result.housing.find((h) => h.townKey === 5),
    index = room.indices.indexOf(locked.key);
  assert.equal(room.states[index], 3);
  assert.equal(room.usages[index], 0);
  assert.ok(
    result.housing.some((h) => h.townKey === 88 && h.cost >= outside.CP)
  );
  user.userWorkers = result.workers;
  user.optimizerPlan = {
    ...result,
    appliedSignature: configurationSignature(user),
  };
  assert.equal(user.totalCP, result.totalCP);
  assert.equal(user.townsInfra[5].lodging, room.houseLodging);
  assert.ok(appliedRouting(user, game));
  user.houseReservations[locked.key] = { usage: 1 };
  assert.equal(appliedRouting(user, game), null);
});

test("home housing and workshop contributions count their shared prerequisite union once", async () => {
  const { game, user } = realGame();
  await game.fetchPlannerData();
  const available = Object.values(game.houseInfo).filter(
    (h) =>
      h.affTown === 88 &&
      h.needHouseKey &&
      Object.keys(h.CraftList).some((u) => Number(u) > 10)
  );
  const first = available.find((h) =>
    available.some(
      (other) => other.key !== h.key && other.needHouseKey === h.needHouseKey
    )
  );
  const second = available.find(
    (h) => h.key !== first.key && h.needHouseKey === first.needHouseKey
  );
  user.userWorkers = [first, second].map((h) => ({
    tnk: game.tk2tnk(88),
    charkey: 7572,
    level: 40,
    job: { kind: "workshop", hk: h.key },
  }));
  user.userWorkshops = {
    [first.key]: { manualCp: 999 },
    [second.key]: { manualCp: 999 },
  };
  user.storagePersonal[88] = 3;
  user.workshopStorage[88] = { coverage: "personal", confirmed: true };
  const r = solveHousing(highs, {
    houses: game.houseInfo,
    townKey: 88,
    reservations: normalizeReservations(game.houseInfo, user),
    wantLodging: 1,
    wantStorage: 0,
    key: "union",
  });
  assert.equal(user.workshopTotalCP, first.CP + second.CP);
  assert.equal(user.townInfra(88, 2, 0).cost + user.workshopTotalCP, r.cost);
  assert.equal(r.indices.filter((k) => k === first.needHouseKey).length, 1);
});

test("real mixed empire retains workshop and idle workers, reuses their routes and reproduces the applied housing budget", async () => {
  const { game, user, market } = realGame();
  await game.fetchPlannerData();
  const factory = (hk) => ({
    tnk: 1,
    charkey: 7572,
    level: 35,
    label: "same",
    wspdSheet: 150,
    mspdSheet: 8,
    luckSheet: 10,
    skills: [],
    job: { kind: "workshop", hk },
  });
  const a = factory(2141),
    b = factory(2143),
    idle = { ...factory(2141), tnk: 61, job: null, level: 25 };
  user.userWorkers = [a, b, idle, { ...idle }, { ...idle }];
  user.storagePersonal[5] = 3;
  user.workshopStorage[5] = { coverage: "personal", confirmed: true };
  const route = {
    autotakenNodes: new Set(),
    pzWsJobs: {
      ws: [a, b].map((worker) => {
        const path = treePath(connectionTree(game.nodes, game.links, 61), 1);
        return { worker, usedPath: path };
      }),
    },
  };
  route.pzWsJobs.ws.forEach((r) =>
    r.usedPath.forEach((id) => route.autotakenNodes.add(id))
  );
  const snapshot = createSnapshot(
    game,
    user,
    market,
    {
      townIds: [1],
      storageTown: 601,
      budget: 80,
      timeLimit: 10,
      maxPlantzones: 20,
      includeGrind: true,
    },
    route
  );
  const result = solveSnapshot(highs, snapshot);
  assert.equal(result.retainedWorkers.length, 5);
  assert.equal(result.fixedWorkshopRoutes.length, 2);
  assert.equal(
    result.housing.find((t) => t.townKey === 5).housingMethod,
    "lookup"
  );
  assert.equal(
    result.housing.find((t) => t.townKey === 88).housingMethod,
    "solve"
  );
  assert.ok(result.workers.length);
  assert.ok(result.fixedBaselineCP > 0);
  assert.ok(result.totalCP <= 80);
  const merged = mergeEmpire(user, result);
  user.userWorkers = merged.workers;
  user.optimizerPlan = {
    ...result,
    fixedWorkerBindings: merged.bindings,
    appliedSignature: configurationSignature(user),
  };
  const applied = appliedRouting(user, game);
  assert.equal(applied.pzWsJobs.ws.length, 2);
  assert.equal(user.userWorkers.filter((w) => w.job === null).length, 3);
  assert.ok(user.userWorkers.includes(a));
  assert.ok(user.userWorkers.includes(b));
  assert.ok(user.userWorkers.includes(idle));
  assert.equal(user.totalCP, result.totalCP);
  for (const town of result.housing)
    assert.equal(user.townsInfra[town.townKey].totalCost, town.cost);
  const oldPrice = market.prices[5401];
  market.prices[5401] = (oldPrice || 0) + 1;
  assert.ok(appliedRouting(user, game));
  user.houseReservations[2112] = { usage: 0 };
  assert.equal(appliedRouting(user, game), null);
});

test("idle workers reserve lodging and fixed-demand budget failures are explained without deleting them", async () => {
  const { game, user, market } = realGame();
  await game.fetchPlannerData();
  user.userWorkers = Array.from({ length: 3 }, () => ({
    tnk: 1,
    charkey: 7572,
    level: 20,
    label: "idle",
    skills: [],
    job: null,
  }));
  const snapshot = createSnapshot(game, user, market, {
    townIds: [1],
    storageTown: 601,
    budget: 1,
    timeLimit: 6,
    maxPlantzones: 20,
    includeGrind: true,
  });
  assert.equal(snapshot.fixedWorkerCounts[5], 3);
  assert.throws(
    () => solveSnapshot(highs, snapshot),
    /Retained requirements need/
  );
  assert.equal(user.userWorkers.length, 3);
  assert.equal(user.userWorkers[0].job, null);
});

test("serialized missing prices remain missing instead of becoming zero-valued prices", async () => {
  const { game, user, market } = realGame();
  await game.fetchPlannerData();
  for (const key of Object.keys(market.prices)) market.prices[key] = NaN;
  const snapshot = createSnapshot(game, user, market, {
    townIds: [1],
    budget: 80,
    timeLimit: 5,
    maxPlantzones: 20,
    storageTown: 601,
    includeGrind: true,
  });
  const prepared = prepareValues(snapshot);
  assert.equal(prepared.candidates.length, 0);
  assert.ok(prepared.missing.length > 0);
});

test("Ancado warehouse stays connected and its infrastructure is counted after applying", async () => {
  const { game, user, market } = realGame();
  await game.fetchPlannerData();
  user.activateAncado = true;
  const snapshot = createSnapshot(game, user, market, {
    townIds: [1343],
    budget: 120,
    timeLimit: 8,
    maxPlantzones: 20,
    storageTown: 1343,
    includeGrind: true,
  });
  const result = solveSnapshot(highs, snapshot);
  assert.ok(
    result.grindRoutes.some(
      (entry) => entry.node === 1343 && entry.infrastructure
    )
  );
  assert.ok(result.selectedNodeIds.includes(1343));
  user.userWorkers = result.workers;
  user.optimizerPlan = {
    ...result,
    appliedSignature: configurationSignature(user),
  };
  assert.equal(user.totalCP, result.totalCP);
  assert.ok(appliedRouting(user, game));
});
