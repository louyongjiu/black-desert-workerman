import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import loadHighs from "highs";
import { solveHousing } from "../src/housing/solve.mjs";
import {
  capacity,
  normalizeReservations,
  townHouses,
  townReservations,
  validateHousing,
} from "../src/housing/core.mjs";

const highs = await loadHighs();
const houses = {
  101: {
    key: 101,
    affTown: 5,
    CP: 1,
    needHouseKey: 0,
    CraftList: { 0: 1, 1: 1, 2: 1, 11: 1 },
  },
  102: {
    key: 102,
    affTown: 5,
    CP: 1,
    needHouseKey: 101,
    CraftList: { 0: 1, 1: 2, 2: 2, 11: 1 },
  },
  103: {
    key: 103,
    affTown: 5,
    CP: 2,
    needHouseKey: 101,
    CraftList: { 0: 1, 1: 1, 2: 3, 11: 1 },
  },
  104: {
    key: 104,
    affTown: 5,
    CP: 2,
    needHouseKey: 0,
    CraftList: { 0: 1, 1: 2, 2: 2 },
  },
};
function enumeration(reservations, lodging, storage) {
  let best = Infinity;
  const list = Object.values(houses);
  for (let n = 0; n < 4 ** list.length; n++) {
    const state = list.map((h, i) => (n >> (2 * i)) & 3); // absent, residence, lodging, storage
    let cost = 0,
      l = 0,
      s = 0,
      valid = true;
    for (let i = 0; i < list.length; i++) {
      const h = list[i],
        lock = reservations[h.key];
      if (
        lock &&
        (lock.usage === 1
          ? state[i] !== 2
          : lock.usage === 2
          ? state[i] !== 3
          : state[i] !== 1)
      )
        valid = false;
      if (!state[i]) continue;
      if (
        h.needHouseKey &&
        !state[list.findIndex((p) => p.key === h.needHouseKey)]
      )
        valid = false;
      cost += h.CP;
      l += state[i] === 2 ? capacity(h, 1) : 0;
      s += state[i] === 3 ? capacity(h, 2) : 0;
    }
    if (valid && l >= lodging && s >= storage) best = Math.min(best, cost);
  }
  return best;
}
test("reserved housing model matches independent exhaustive choices and counts shared prerequisites once", () => {
  for (const reservations of [
    {},
    { 102: { usage: 11, automatic: true } },
    { 102: { usage: 11 }, 103: { usage: 11 } },
    { 101: { usage: 0 } },
    { 104: { usage: 1 } },
  ])
    for (const [l, s] of [
      [0, 0],
      [1, 3],
      [2, 5],
      [3, 8],
      [8, 20],
    ]) {
      const expected = enumeration(reservations, l, s);
      const result = solveHousing(highs, {
        houses,
        townKey: 5,
        reservations,
        wantLodging: l,
        wantStorage: s,
        key: "test",
        timeLimit: 2,
      });
      assert.equal(result.success, Number.isFinite(expected));
      if (result.success) {
        assert.equal(result.cost, expected);
        validateHousing(houses, 5, reservations, result, l, s);
      }
    }
  const r = solveHousing(highs, {
    houses,
    townKey: 5,
    reservations: { 102: { usage: 11 }, 103: { usage: 11 } },
    wantLodging: 0,
    wantStorage: 0,
    key: "shared",
  });
  assert.equal(r.cost, 4);
  assert.equal(r.indices.filter((k) => k === 101).length, 1);
});
test("workshops reserve only working houses, reject conflicting uses, and count each workshop once", () => {
  const user = {
    houseReservations: { 104: { usage: 1 } },
    userWorkshops: { 103: {} },
    userWorkers: [
      { job: { kind: "workshop", hk: 102 } },
      { job: { kind: "workshop", hk: 102 } },
    ],
  };
  const r = normalizeReservations(houses, user);
  assert.equal(r[102].automatic, true);
  assert.equal(r[103], undefined);
  const plan = solveHousing(highs, {
    houses,
    townKey: 5,
    reservations: r,
    wantLodging: 1,
    wantStorage: 0,
    key: "automatic",
  });
  assert.equal(plan.workshopCP, 1);
  assert.throws(
    () =>
      normalizeReservations(houses, {
        ...user,
        houseReservations: { 102: { usage: 0 } },
      }),
    /another use/
  );
  assert.throws(
    () =>
      normalizeReservations(houses, {
        houseReservations: { 999: { usage: 2 } },
      }),
    /invalid/
  );
});
test("housing validator rejects changed totals, missing parents and stolen reserved uses", () => {
  const locks = { 102: { usage: 11 } };
  const plan = solveHousing(highs, {
    houses,
    townKey: 5,
    reservations: locks,
    wantLodging: 0,
    wantStorage: 0,
    key: "check",
  });
  assert.throws(
    () => validateHousing(houses, 5, locks, { ...plan, cost: 0 }),
    /totals/
  );
  assert.throws(
    () =>
      validateHousing(houses, 5, locks, {
        ...plan,
        indices: [5, 102],
        states: [0, 3],
        usages: [null, 11],
      }),
    /dependencies/
  );
  assert.throws(
    () =>
      validateHousing(houses, 5, locks, {
        ...plan,
        usages: plan.usages.map((u, i) => (plan.indices[i] === 102 ? 0 : u)),
      }),
    /reservation/
  );
  assert.throws(
    () =>
      townHouses({ ...houses, 101: { ...houses[101], needHouseKey: 102 } }, 5),
    /cycle/
  );
});
test("real housing data is consistent, all town minimum costs match the unconstrained lookup", () => {
  const read = (p) =>
    JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
  const real = read("data/houseinfo.json"),
    table = read("data/all_lodging_storage.json");
  for (const [town, t] of Object.entries(table)) {
    for (const [l, entries] of Object.entries(t))
      for (const e of entries)
        validateHousing(real, town, {}, { ...e, lodging: Number(l) }, 0, 0);
    const demand = Object.values(real).some(
      (h) => Number(h.affTown) === Number(town) && capacity(h, 1) > 0
    )
      ? 1
      : 0;
    const s = 3,
      options = Object.entries(t).flatMap(([l, list]) =>
        list.filter((e) => Number(l) >= demand && e.storage >= s)
      );
    const result = solveHousing(highs, {
      houses: real,
      townKey: Number(town),
      reservations: {},
      wantLodging: demand,
      wantStorage: s,
      key: town,
      timeLimit: 3,
    });
    assert.equal(result.success, !!options.length);
    if (result.success)
      assert.equal(result.cost, Math.min(...options.map((e) => e.cost)), town);
  }
  for (const town of [77, 229, 32]) {
    const lockHouse = Object.values(real).find(
      (h) =>
        h.affTown === town &&
        Object.keys(h.CraftList).some((u) => Number(u) > 10)
    );
    const locks = { [lockHouse.key]: { usage: 11 } };
    locks[lockHouse.key].usage = Object.keys(lockHouse.CraftList)
      .map(Number)
      .find((u) => u > 10);
    const result = solveHousing(highs, {
      houses: real,
      townKey: town,
      reservations: locks,
      wantLodging: 4,
      wantStorage: 25,
      key: "large" + town,
      timeLimit: 3,
    });
    assert.equal(result.success, true);
    validateHousing(real, town, locks, result, 4, 25);
  }
});

function storeHarness() {
  const game = {
    houseInfo: houses,
    plannerReady: true,
    lsLookup: () => ({
      success: true,
      cost: 0,
      lodging: 0,
      storage: 0,
      indices: [5],
      states: [0],
    }),
  };
  const user = {
    houseReservations: { 102: { usage: 11 } },
    housingPlans: {},
    housingUndo: null,
    userWorkers: [],
    $patch(value) {
      Object.assign(this, value);
    },
  };
  const workers = [],
    microtasks = [];
  class Worker {
    constructor() {
      workers.push(this);
    }
    postMessage(job) {
      this.job = job;
    }
    terminate() {
      this.terminated = true;
    }
  }
  const source = readFileSync(
    new URL("../src/stores/housing.js", import.meta.url),
    "utf8"
  )
    .replace(/^import[\s\S]*?;\r?\n/gm, "")
    .replaceAll("export function ", "function ")
    .replace(/export const useHousingStore\s*=/, "const useHousingStore=")
    .replaceAll("import.meta.url", JSON.stringify(import.meta.url));
  const options = vm.runInNewContext(source + "\nuseHousingStore", {
    defineStore: (name, opts) => opts,
    useGameStore: () => game,
    useUserStore: () => user,
    normalizeReservations,
    townHouses,
    townReservations,
    validateHousing,
    Worker,
    URL,
    queueMicrotask: (cb) => microtasks.push(cb),
  });
  const store = options.state();
  store.$state = store;
  for (const [key, fn] of Object.entries(options.actions))
    store[key] = fn.bind(store);
  const flush = () => {
    while (microtasks.length) microtasks.shift()();
  };
  return { store, user, workers, flush };
}
test("housing queue coalesces requests, ignores obsolete results, saves and undoes, stops and retries", () => {
  const { store, user, workers, flush } = storeHarness();
  const pending = store.lookup(5, 1, 3, 2);
  store.lookup(5, 1, 3, 2);
  flush();
  assert.equal(workers.length, 1);
  const job = workers[0].job,
    result = solveHousing(highs, job);
  workers[0].onmessage({ data: { key: job.key, type: "complete", result } });
  assert.equal(store.lookup(5, 1, 3).cost, result.cost);
  store.save(store.lookup(5, 1, 3));
  assert.ok(user.housingPlans[5]);
  store.undo();
  assert.equal(user.housingPlans[5], undefined);
  store.reserve(104, "1");
  assert.equal(user.houseReservations[104].usage, 1);
  store.undo();
  assert.equal(user.houseReservations[104], undefined);
  const next = store.lookup(5, 2, 3);
  flush();
  store.stop(next.sourceKey);
  assert.ok(workers[0].terminated);
  workers[0].onmessage({
    data: {
      key: next.sourceKey,
      type: "complete",
      result: { success: true, cost: -1 },
    },
  });
  assert.equal(store.lookup(5, 2, 3).success, false);
  store.retry(next.sourceKey);
  store.lookup(5, 2, 3);
  flush();
  assert.equal(workers.length, 2);
  const retriedKey = workers[1].job.key;
  workers[0].onmessage({
    data: {
      key: retriedKey,
      type: "complete",
      result: { success: true, cost: -1 },
    },
  });
  assert.equal(store.results[retriedKey], undefined);
  store.reserve(104, "1");
  store.lookup(5, 2, 3);
  flush();
  workers[1].onmessage({
    data: {
      key: workers[1].job.key,
      type: "complete",
      result: { success: true, cost: -1 },
    },
  });
  assert.notEqual(store.results[workers[1].job.key]?.cost, -1);
  assert.equal(pending.pending, true);
  assert.equal(
    store.lookup(5, -1, -8).sourceKey,
    store.lookup(5, 0, 0).sourceKey
  );
  assert.equal(store.lookup("5", 1, 3).cost, store.lookup(5, 1, 3).cost);
});
