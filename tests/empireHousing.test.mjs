import test from "node:test";
import assert from "node:assert/strict";
import loadHighs from "highs";
import {
  storageRequirements,
  employeeCounts,
  fingerprint,
  planningDataSignature,
  workshopReviewSignature,
} from "../src/housing/requirements.mjs";
import {
  captureFixedWorkshops,
  supportedEmpire,
} from "../src/optimizer/fixedWorkshops.mjs";
import { mergeEmpire, restoredWorkers } from "../src/optimizer/application.mjs";
import { configurationSignature } from "../src/optimizer/snapshot.mjs";
import { housingFromPlan } from "../src/housing/empire.mjs";
import { buildModel } from "../src/optimizer/model.mjs";
import { decodeResult } from "../src/optimizer/result.mjs";
import { greedySeed } from "../src/optimizer/seed.mjs";
import { connectionShares } from "../src/optimizer/shares.mjs";

const highs = await loadHighs();
function gameFixture() {
  return {
    nodes: {
      1: { key: 1, kind: 2, CP: 0 },
      2: { key: 2, kind: 0, CP: 2 },
      3: { key: 3, kind: 2, CP: 0 },
      4: { key: 4, kind: 9, CP: 1 },
    },
    links: { 1: [2], 2: [1, 3, 4], 3: [2], 4: [2] },
    tnk2tk: (n) => Number(n),
    tk2tnk: (n) => Number(n),
    houseInfo: {
      101: {
        key: 101,
        affTown: 3,
        needHouseKey: 0,
        CP: 2,
        CraftList: { 0: 1, 11: 1 },
      },
      201: {
        key: 201,
        affTown: 1,
        needHouseKey: 0,
        CP: 1,
        CraftList: { 0: 1, 1: 2 },
      },
      202: {
        key: 202,
        affTown: 1,
        needHouseKey: 201,
        CP: 1,
        CraftList: { 0: 1, 1: 1 },
      },
    },
    itemInfo: {
      11: { isStack: true },
      12: { isStack: false },
      13: { isStack: true },
    },
    craftInputs: { 7: { 11: 1 }, 8: { 11: 1 } },
    craftOutputs: { 7: [11], 8: [12] },
    plantzoneDrops: {
      4: { unlucky: { 11: 1, 13: 2 }, unlucky_gi: { 11: 0 }, lucky: {} },
    },
    profitWorkshopWorker: () => ({ priceDaily: 2 }),
    regionInfo: {},
    tk2hk: {},
  };
}
function userFixture() {
  const idle = {
    tnk: 1,
    charkey: 1,
    level: 25,
    label: "same",
    skills: [],
    job: null,
  };
  const w1 = {
    tnk: 1,
    charkey: 1,
    level: 35,
    label: "same",
    skills: [],
    job: { kind: "workshop", hk: 101, recipe: 7 },
  };
  const w2 = structuredClone(w1);
  return {
    userWorkers: [idle, w1, w2],
    storagePersonal: {},
    workshopStorage: {},
    getUserWorkshop: () => ({ industry: "mass", manualCycleIncome: 1 }),
  };
}
test("shared storage unions gathering and workshop items, migrates reservations once and rejects invalid capacity", () => {
  const game = gameFixture(),
    user = userFixture();
  user.userWorkers.push({
    tnk: 1,
    job: { kind: "plantzone", pzk: 4, storage: 1 },
  });
  user.storagePersonal[1] = 10;
  user.workshopStorage[1] = {
    personalIncludes: 2,
    extraSlots: 1,
    confirmed: true,
  };
  const r = storageRequirements(game, user)[1];
  assert.deepEqual(r.items, { 11: 1, 13: 1 });
  assert.equal(r.personal, 8);
  assert.equal(r.total, 12);
  assert.equal(r.spare, 1);
  assert.equal(r.resolved, true);
  user.workshopStorage[1].personalIncludes = 11;
  assert.equal(storageRequirements(game, user)[1].resolved, false);
  user.workshopStorage[1].extraSlots = 193;
  assert.equal(storageRequirements(game, user)[1].resolved, false);
  user.workshopStorage[1] = { coverage: "personal", confirmed: true };
  const p = storageRequirements(game, user)[1];
  assert.equal(p.personal, 10);
  assert.deepEqual(p.items, { 11: 1, 13: 1 });
  assert.equal(p.total, 13);
});
test("missing recipes and non-stackable products require explicit reservations; duplicates share the warehouse quantity", () => {
  const game = gameFixture(),
    user = userFixture();
  user.userWorkers[1].job.recipe = 8;
  user.userWorkers[2].job.recipe = 8;
  let r = storageRequirements(game, user)[1];
  assert.equal(r.resolved, false);
  assert.ok(r.nonStack.includes("12"));
  user.workshopStorage[1] = { itemSlots: { 12: 4 }, confirmed: true };
  r = storageRequirements(game, user)[1];
  assert.equal(r.total, 6);
  assert.equal(r.items[12], 4);
  assert.equal(r.resolved, true);
  user.userWorkers[1].job.recipe = 999;
  user.workshopStorage[1].confirmed = false;
  assert.equal(storageRequirements(game, user)[1].resolved, false);
  user.workshopStorage[1].confirmed = true;
  assert.equal(storageRequirements(game, user)[1].resolved, true);
  user.storagePersonal[1] = 192;
  user.workshopStorage[1] = { coverage: "personal", confirmed: true };
  assert.equal(storageRequirements(game, user)[1].resolved, false);
});

test("reviewed workshop reservations need review again after recipe or personal-reservation changes", () => {
  const game = gameFixture(),
    user = userFixture();
  user.storagePersonal[1] = 10;
  user.workshopStorage[1] = { coverage: "personal", confirmed: true };
  const workshops = storageRequirements(game, user)[1].workshops;
  user.workshopStorage[1].confirmedFor = workshopReviewSignature(
    game,
    user,
    1,
    workshops
  );
  assert.equal(storageRequirements(game, user)[1].resolved, true);
  user.storagePersonal[1] = 11;
  assert.equal(storageRequirements(game, user)[1].resolved, false);
  user.storagePersonal[1] = 10;
  user.userWorkers[1].job.recipe = 999;
  assert.equal(storageRequirements(game, user)[1].resolved, false);
});
test("retention snapshot keeps same-name workers separately, captures only workshop paths and counts idle beds", () => {
  const game = gameFixture(),
    user = userFixture();
  const routing = {
    autotakenNodes: new Set([1, 2, 3, 4]),
    pzWsJobs: {
      ws: user.userWorkers
        .filter((w) => w.job)
        .map((worker) => ({ worker, usedPath: [1, 2, 3] })),
    },
  };
  const fixed = captureFixedWorkshops(game, user, routing);
  assert.equal(fixed.workers.length, 3);
  assert.equal(fixed.routes.length, 2);
  assert.equal(fixed.counts[1], 3);
  assert.deepEqual(fixed.nodes, [1, 2, 3]);
  assert.equal(fixed.storage[1].total, 2);
  assert.deepEqual(employeeCounts(game, user.userWorkers), { 1: 3 });
  assert.throws(
    () => captureFixedWorkshops(game, user, { pzWsJobs: { ws: [] } }),
    /route is invalid/
  );
  const result = {
    schemaVersion: 2,
    retainedWorkers: fixed.workers,
    workers: [{ tnk: 1, label: "new", job: { kind: "plantzone", pzk: 4 } }],
  };
  const merged = mergeEmpire(user, result);
  assert.equal(merged.workers.length, 4);
  assert.equal(merged.workers[0], user.userWorkers[0]);
  assert.equal(merged.workers[1], user.userWorkers[1]);
  assert.equal(merged.workers[2], user.userWorkers[2]);
  const out = JSON.parse(
    JSON.stringify({ ...user, userWorkers: merged.workers })
  );
  assert.equal(
    Object.keys(
      restoredWorkers({ ...result, fixedWorkerBindings: merged.bindings }, out)
    ).length,
    3
  );
  assert.throws(
    () => mergeEmpire(user, { ...result, workers: [] }),
    /Confirm removal/
  );
  assert.equal(
    mergeEmpire(user, { ...result, workers: [] }, true).workers.length,
    3
  );
  user.userWorkers[1].level++;
  assert.throws(() => mergeEmpire(user, result), /changed/);
});
test("fixed connections, beds and storage enter one shared budget and agree with a separately counted small scenario", () => {
  const game = gameFixture(),
    user = userFixture();
  const fixed = captureFixedWorkshops(game, user, {
    pzWsJobs: {
      ws: user.userWorkers
        .filter((w) => w.job)
        .map((worker) => ({ worker, usedPath: [1, 2, 3] })),
    },
  });
  for (const budget of [4, 5, 6, 7, 10]) {
    const snapshot = {
      schemaVersion: 2,
      nodes: game.nodes,
      links: game.links,
      houses: game.houseInfo,
      houseReservations: { 101: { usage: 11, automatic: true } },
      retainedWorkers: fixed.workers,
      fixedWorkshopRoutes: fixed.routes,
      fixedNodeIds: fixed.nodes,
      lockedNodeIds: [],
      townIds: [1],
      storageTown: 1,
      baseStorage: 8,
      storageP2W: {},
      budget,
      createdAt: "fixture",
    };
    const prepared = {
      candidates: [
        {
          pzk: 4,
          town: 1,
          value: 5e6,
          itemKeys: ["13"],
          worker: { charkey: 1, wspd: 100, mspd: 10, luck: 10, skills: [] },
        },
      ],
      plantzoneIds: [4],
      itemKeys: ["13"],
      fixedInfrastructure: [],
      missing: [],
      consideredPlantzones: 1,
      eligiblePlantzones: 1,
      infrastructure: [
        {
          town: 1,
          townKey: 1,
          warehouse: true,
          freeLodging: -2,
          baseLodging: 1,
          freeStorage: 6,
          fixedWorkerCount: 3,
          fixedItems: { 11: 1 },
          fixedSpare: 1,
          fixedStorageCount: 2,
          storageLimit: 192,
          choices: [
            {
              cost: 1,
              lodging: 0,
              storage: 2,
              houseLodging: 2,
              houseStorage: 0,
              indices: [1, 201],
              states: [0, 2],
            },
            {
              cost: 2,
              lodging: 1,
              storage: 2,
              houseLodging: 3,
              houseStorage: 0,
              indices: [1, 201, 202],
              states: [0, 2, 2],
            },
          ],
        },
        {
          town: 3,
          townKey: 3,
          warehouse: false,
          dynamicHousing: true,
          freeLodging: 1,
          baseLodging: 1,
          freeStorage: 8,
          fixedWorkerCount: 0,
          fixedStorageCount: 0,
          fixedItems: {},
          fixedSpare: 0,
          storageLimit: 192,
          choices: [
            {
              cost: 2,
              lodging: 0,
              storage: 0,
              indices: [3, 101],
              states: [0, 3],
              usages: [null, 11],
            },
          ],
        },
      ],
    };
    const problem = buildModel(snapshot, prepared),
      model = highs.createModel(problem.data);
    try {
      const seed = greedySeed(problem);
      if (seed) {
        const decoded = decodeResult(problem, seed);
        assert.ok(decoded.totalCP <= budget);
        model.setSolution({ colValue: seed });
      }
      model.options.set({ output_flag: false, mip_rel_gap: 0 });
      model.run();
      if (budget < 5) {
        assert.equal(
          model.getModelStatus(),
          highs.constants.modelStatus.infeasible
        );
        continue;
      }
      assert.equal(model.getModelStatus(), highs.constants.modelStatus.optimal);
      const r = decodeResult(problem, model.getSolution().colValue);
      assert.equal(r.profitSilverPerDay, budget >= 7 ? 5e6 : 0);
      assert.equal(r.totalCP, budget >= 7 ? 7 : 5);
      assert.equal(r.nodeCP, budget >= 7 ? 3 : 2);
      assert.equal(
        r.housing.find((h) => h.townKey === 1).workerCount,
        budget >= 7 ? 4 : 3
      );
      assert.equal(
        r.housing.find((h) => h.townKey === 1).storageCount,
        budget >= 7 ? 3 : 2
      );
    } finally {
      model.dispose();
    }
  }
});
test("cash-flow display shares never become negative or NaN when workshop income is negative or unknown", () => {
  const jobs = [
    { usedPath: [1, 2], profit: { priceDaily: -5 } },
    { usedPath: [2, 3], profit: { priceDaily: NaN } },
  ];
  const shares = connectionShares(
    { pzWsJobs: { map: jobs }, autotakenGrindNodes: new Set() },
    { 1: { CP: 0 }, 2: { CP: 2 }, 3: { CP: 0 } }
  );
  assert.equal(shares.get(jobs[0]).value, 1);
  assert.equal(shares.get(jobs[1]).value, 1);
  jobs[1].profit.priceDaily = 10;
  const positive = connectionShares(
    { pzWsJobs: { map: jobs }, autotakenGrindNodes: new Set() },
    { 1: { CP: 0 }, 2: { CP: 2 }, 3: { CP: 0 } }
  );
  assert.equal(positive.get(jobs[0]).value, 0);
  assert.equal(positive.get(jobs[1]).value, 2);
});

test("exporting an applied smaller empire follows retained-worker bindings after indices shift", () => {
  const user = userFixture(),
    fixed = user.userWorkers[1];
  user.userWorkers = [
    { tnk: 1, job: { kind: "plantzone", pzk: 4 } },
    { tnk: 1, job: { kind: "plantzone", pzk: 5 } },
    fixed,
  ];
  const result = {
    schemaVersion: 2,
    retainedWorkers: [
      { index: 2, worker: fixed, fingerprint: fingerprint(fixed) },
    ],
    workers: [{ tnk: 1, job: { kind: "plantzone", pzk: 6 } }],
  };
  const merged = mergeEmpire(user, result);
  user.userWorkers = merged.workers;
  const plan = {
    ...result,
    fixedWorkerBindings: merged.bindings,
    appliedSignature: configurationSignature(user),
  };
  assert.equal(merged.bindings[0].index, 1);
  const exported = mergeEmpire(user, plan);
  assert.equal(exported.workers[1], fixed);
  assert.equal(exported.bindings[0].originalIndex, 2);
  assert.equal(
    restoredWorkers(plan, JSON.parse(JSON.stringify(user)))[2].job.hk,
    fixed.job.hk
  );
});

test("old gathering housing is read as raw house capacity and excludes free/paid capacity", () => {
  const game = gameFixture(),
    user = { baseStorage: 8, storagePersonal: { 1: 2 }, lodgingP2W: {} };
  const plan = {
    schemaVersion: 1,
    housing: [
      {
        townKey: 1,
        indices: [1, 201],
        states: [0, 2],
        lodging: 3,
        storage: 6,
        workerCount: 3,
        storageCount: 4,
      },
    ],
  };
  const housing = housingFromPlan(plan, 1, game, user);
  assert.equal(housing.lodging, 2);
  assert.equal(housing.storage, 0);
  assert.equal(housing.wantLodging, 2);
  assert.equal(housing.wantStorage, -2);
  assert.equal(housing.storageCount, 6);
});

test("retained Ancado workshop routes include their existing activation connection", () => {
  const game = gameFixture(),
    user = userFixture();
  game.nodes[1343] = { key: 1343, kind: 3, CP: 0 };
  game.nodes[3] = { ...game.nodes[3], kind: 3 };
  game.links = { ...game.links, 1343: [2], 2: [...game.links[2], 1343] };
  user.userWorkers = [{ ...user.userWorkers[1], tnk: 1343 }];
  const routing = {
    autotakenNodes: new Set([1343, 2, 3]),
    pzWsJobs: { ws: [{ worker: user.userWorkers[0], usedPath: [1343, 2, 3] }] },
  };
  const fixed = captureFixedWorkshops(game, user, routing);
  assert.equal(fixed.activationRoutes.length, 1);
  assert.deepEqual(fixed.activationRoutes[0].path, [1343, 2, 1]);
  assert.equal(fixed.counts[1343], 1);
  game.links = { ...game.links, 2: [3, 4, 1343], 1: [] };
  assert.throws(
    () => captureFixedWorkshops(game, user, routing),
    /activation connection/
  );
});
test("dormant trade settings are preserved, active unsupported tasks are rejected, data changes invalidate signatures", () => {
  const game = gameFixture(),
    user = userFixture();
  user.tradeDestinations = { 1: 3 };
  assert.equal(supportedEmpire(user), true);
  user.tradeRouteAlwaysOn = { 1: true };
  assert.equal(supportedEmpire(user), false);
  user.tradeRouteAlwaysOn = {};
  user.palaceEnable = true;
  assert.equal(supportedEmpire(user), false);
  const signature = planningDataSignature(game);
  game.links = { ...game.links, 4: [] };
  assert.notEqual(planningDataSignature(game), signature);
  assert.equal(
    fingerprint({ job: { recipe: undefined, hk: 1 }, level: 40 }),
    fingerprint({ level: 40, job: { hk: 1 } })
  );
});
