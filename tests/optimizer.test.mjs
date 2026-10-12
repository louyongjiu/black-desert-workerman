import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { localizeGameLanguage } from "../src/i18n/game.mjs";
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
