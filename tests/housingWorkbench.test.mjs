import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import loadHighs from "highs";
import { solveHousing } from "../src/housing/solve.mjs";
import {
  normalizeReservations,
  townHouses,
  townHousingPolicy,
  validateHousing,
} from "../src/housing/core.mjs";
import { fingerprint, STORAGE_LIMIT } from "../src/housing/requirements.mjs";
import { housingFromPlan } from "../src/housing/empire.mjs";
import * as workbench from "../src/housing/workbench.mjs";
import { routeDataRequirements, loadRouteData } from "../src/routeData.mjs";
const highs = await loadHighs();
function fixture() {
  const game = {
    plannerReady: true,
    tnk2tk: (value) => Number(value),
    houseInfo: {
      101: {
        key: 101,
        affTown: 5,
        CP: 1,
        needHouseKey: 0,
        CraftList: { 0: 1, 1: 2, 2: 2 },
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
        CraftList: { 0: 1, 1: 3, 2: 3, 11: 1 },
      },
      104: {
        key: 104,
        affTown: 5,
        CP: 2,
        needHouseKey: 0,
        CraftList: { 0: 1, 1: 3, 2: 3 },
      },
      201: {
        key: 201,
        affTown: 6,
        CP: 1,
        needHouseKey: 0,
        CraftList: { 0: 1, 1: 2, 2: 2 },
      },
    },
    craftInputs: { 9: { 50: 1 } },
    craftOutputs: { 9: [60] },
    itemInfo: { 50: { isStack: true }, 60: { isStack: true } },
  };
  const user = {
    baseStorage: 8,
    lodgingP2W: { 5: 2 },
    storageP2W: { 5: 16 },
    houseReservations: { 104: { usage: 1 }, 201: { usage: 0 } },
    workshopStorage: { 5: { coverage: "personal", confirmed: true } },
    storagePersonal: { 5: 4, 6: 2 },
    housingPlans: {
      5: {
        cost: 99,
        indices: [5, 101],
        states: [0, 1],
        wantLodging: 1,
        wantStorage: 5,
      },
    },
    userWorkers: [
      { tnk: 5, job: { kind: "workshop", hk: 102, recipe: 9 } },
      { tnk: 6, job: null },
    ],
    optimizerPlan: { unchanged: true },
    $patch(fn) {
      fn(this);
    },
  };
  game.lsLookup = (tk, beds, storage) =>
    solveHousing(highs, {
      houses: game.houseInfo,
      townKey: tk,
      reservations: {},
      wantLodging: beds,
      wantStorage: storage,
      key: "lookup",
    });
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
  function options(file, name, extras) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8")
      .replace(/^import[\s\S]*?;\r?\n/gm, "")
      .replaceAll("export function ", "function ")
      .replace("export const " + name, "const " + name)
      .replaceAll("import.meta.url", JSON.stringify(import.meta.url));
    return vm.runInNewContext(
      source +
        "\n({ options: " +
        name +
        ', request: typeof housingRequest === "function" ? housingRequest : null })',
      {
        defineStore: (_name, opts) => opts,
        useGameStore: () => game,
        useUserStore: () => user,
        ...extras,
      }
    );
  }
  function bind(opts) {
    const store = opts.state();
    store.$state = store;
    for (const [key, fn] of Object.entries(opts.actions))
      store[key] = fn.bind(store);
    return store;
  }
  const loaded = options("../src/stores/housing.js", "useHousingStore", {
    normalizeReservations,
    townHouses,
    townHousingPolicy,
    validateHousing,
    validAppliedPlan: () => false,
    housingFromPlan,
    STORAGE_LIMIT,
    Worker,
    URL,
    queueMicrotask: (fn) => microtasks.push(fn),
  });
  const housing = bind(loaded.options);
  const editor = bind(
    options("../src/stores/housingWorkbench.js", "useHousingWorkbenchStore", {
      ...workbench,
      normalizeReservations,
      validateHousing,
      fingerprint,
      housingFromPlan,
      housingRequest: loaded.request,
      useHousingStore: () => housing,
    }).options
  );
  const flush = () => {
    while (microtasks.length) microtasks.shift()();
  };
  const complete = (worker) =>
    worker.onmessage({
      data: {
        key: worker.job.key,
        type: "complete",
        result: solveHousing(highs, worker.job),
      },
    });
  return {
    game,
    user,
    housing,
    editor,
    workers,
    flush,
    complete,
    request: loaded.request,
  };
}
const serialized = (value) => JSON.parse(JSON.stringify(value));
test("empire edits stay in drafts; scoped reset, save and undo preserve workshops, paid capacity and trial records", () => {
  const { user, editor, game } = fixture(),
    original = serialized(user),
    employees = user.userWorkers;
  editor.updateEmpire(5, {
    houseReservations: { 103: { usage: 0 } },
    workshopStorage: { coverage: "automatic", extraSlots: 3 },
    storagePersonal: 2,
  });
  editor.ensureEmpire(6);
  assert.deepEqual(serialized(user), original);
  editor.resetEmpire(5);
  assert.deepEqual(serialized(editor.empire[5].settings.houseReservations), {});
  assert.equal(editor.empire[5].settings.storagePersonal, 2);
  assert.equal(
    normalizeReservations(game.houseInfo, user)[102].automatic,
    true
  );
  editor.undoEmpire(5);
  assert.equal(editor.empire[5].settings.houseReservations[103].usage, 0);
  editor.saveEmpire();
  assert.equal(user.userWorkers, employees);
  assert.equal(user.houseReservations[201].usage, 0);
  assert.equal(user.houseReservations[103].usage, 0);
  assert.equal(user.workshopStorage[5].extraSlots, 3);
  assert.equal(user.housingPlans[5].cost, 99);
  assert.equal(user.lodgingP2W[5], 2);
  user.houseReservations[201] = { usage: 1 }; // unrelated later city edit must survive undo
  editor.undoSavedEmpire();
  assert.equal(user.houseReservations[104].usage, 1);
  assert.equal(user.houseReservations[201].usage, 1);
  assert.deepEqual(serialized(user.workshopStorage), original.workshopStorage);
  assert.equal(user.storagePersonal[5], 4);
});
test("dirty town drafts survive switching, reject conflicting live edits, and protect actual workshop uses", () => {
  const { user, editor } = fixture();
  assert.throws(
    () => editor.updateEmpire(5, { houseReservations: { 102: { usage: 0 } } }),
    /another use/
  );
  editor.updateEmpire(5, { houseReservations: { 103: { usage: 0 } } });
  editor.ensureEmpire(6);
  editor.ensureEmpire(5);
  assert.equal(editor.empire[5].settings.houseReservations[103].usage, 0);
  user.storagePersonal[5] = 7;
  assert.throws(() => editor.saveEmpire(), /changed elsewhere/);
  assert.equal(user.storagePersonal[5], 7);
  assert.equal(user.houseReservations[104].usage, 1);
  editor.discardEmpire(5);
  assert.equal(editor.empire[5].settings.storagePersonal, 7);
  assert.equal(editor.empireDirty(5), false);
});
test("unchanged drafts cannot hide later saved edits in another town", () => {
  const { game, user, editor } = fixture();
  editor.ensureEmpire(5);
  editor.ensureEmpire(6);
  user.houseReservations[104] = { usage: 0 };
  user.storagePersonal[5] = 8;
  editor.updateEmpire(6, { storagePersonal: 3 });
  const projected = workbench.draftUser(
    game,
    user,
    workbench.activeEmpireDrafts(editor.empire)
  );
  assert.equal(projected.houseReservations[104].usage, 0);
  assert.equal(projected.storagePersonal[5], 8);
  assert.equal(projected.storagePersonal[6], 3);
  assert.equal(editor.empireDirty(5), false);
  assert.equal(editor.empireDirty(6), true);
  editor.saveEmpire();
  assert.equal(user.storagePersonal[5], 8);
  assert.equal(user.storagePersonal[6], 3);
});
test("trial deductions validate total needs, including empty, fractional and over-limit inputs", () => {
  const inputs = {
    workers: 6,
    storage: 40,
    freeBeds: 1,
    paidBeds: 2,
    freeStorage: 8,
    paidStorage: 16,
  };
  assert.deepEqual(workbench.trialDemand(inputs), {
    workerCount: 6,
    storageCount: 40,
    baseLodging: 3,
    baseStorage: 24,
    wantLodging: 3,
    wantStorage: 16,
  });
  for (const patch of [
    { workers: null },
    { workers: 1.5 },
    { workers: -1 },
    { storage: 193 },
    { paidStorage: 193 },
  ])
    assert.throws(
      () => workbench.trialDemand({ ...inputs, ...patch }),
      /invalid/
    );
  assert.equal(
    workbench.trialDemand({ ...inputs, freeStorage: 192, paidStorage: 16 })
      .wantStorage,
    0
  );
});
test("private trial copies are editable, calculate only on start, save locally, and reset without deleting records", () => {
  const { user, editor, housing, workers, flush, complete } = fixture(),
    original = serialized(user);
  editor.copyEmpire(5);
  assert.equal(editor.trials[5].inputs.reservations[102].usage, 11);
  assert.equal(editor.trials[5].inputs.reservations[102].automatic, undefined);
  editor.updateTrial(5, {
    workers: 4,
    storage: 29,
    reservations: { 102: { usage: 0 } },
  });
  assert.equal(workers.length, 0);
  assert.equal(editor.trialResult(5), null);
  editor.runTrial(5);
  flush();
  assert.equal(workers.length, 1);
  assert.equal(workers[0].job.reservations[102].usage, 0);
  assert.equal(workers[0].job.scope, "trial");
  complete(workers[0]);
  assert.equal(editor.trialResult(5).success, true);
  const cp = editor.trialResult(5).cost;
  editor.updateTrial(5, { workers: 5 });
  assert.equal(editor.trialStale(5), true);
  assert.equal(editor.trialResult(5).workerCount, 4);
  assert.equal(editor.trialResult(5).cost, cp);
  assert.throws(() => editor.saveTrial(5), /calculate again/);
  editor.undoTrial(5);
  editor.saveTrial(5);
  assert.equal(user.housingPlans[5].trialInputs.reservations[102].usage, 0);
  const saved = serialized(user.housingPlans[5]);
  editor.resetTrial(5);
  assert.equal(editor.trials[5].inputs.workers, 0);
  assert.deepEqual(serialized(user.housingPlans[5]), saved);
  editor.undoTrial(5);
  assert.equal(editor.trials[5].inputs.workers, 4);
  editor.deleteTrial(5);
  assert.equal(user.housingPlans[5], undefined);
  editor.undoTrialRecord(5);
  assert.deepEqual(serialized(user.housingPlans[5]), saved);
  assert.deepEqual(
    serialized({ ...user, housingPlans: original.housingPlans }),
    original
  );
  assert.equal(housing.busyKey, null);
});

test("copying a preview town absent from the plan clears old live demand", () => {
  const { user, editor, housing } = fixture();
  housing.empireSource = { plan: { schemaVersion: 2, housing: [] } };
  editor.copyEmpire(6);
  assert.equal(editor.trials[6].inputs.workers, 0);
  assert.equal(editor.trials[6].inputs.storage, 0);
  delete housing.empireSource;
  editor.copyEmpire(6);
  assert.equal(editor.trials[6].inputs.workers, 1);
  assert.equal(editor.trials[6].inputs.storage, 2);
  assert.equal(user.userWorkers.length, 2);
});
test("same-town empire and trial requests have separate contexts; late workers cannot overwrite reset trial results", () => {
  const { user, housing, editor, workers, flush, complete } = fixture();
  const empire = housing.lookup(5, 1, 5);
  flush();
  editor.updateTrial(5, {
    workers: 4,
    storage: 29,
    reservations: { 102: { usage: 0 } },
  });
  editor.runTrial(5);
  flush();
  const trialKey = editor.trials[5].sourceKey;
  assert.notEqual(trialKey, empire.sourceKey);
  complete(workers[0]);
  assert.equal(housing.results[empire.sourceKey].success, true);
  assert.equal(workers[0].job.key, trialKey);
  editor.resetTrial(5);
  assert.equal(workers[0].terminated, true);
  complete(workers[0]);
  assert.equal(editor.trialResult(5), null);
  assert.equal(housing.results[trialKey].success, false);
  assert.equal(user.houseReservations[104].usage, 1);
});
test("legacy records load into private demand inputs; scoped empire reset leaves the record intact", () => {
  const { user, editor } = fixture(),
    original = serialized(user);
  editor.loadTrial(5);
  assert.equal(editor.trials[5].inputs.workers, 4);
  assert.equal(editor.trials[5].inputs.storage, 29);
  editor.resetEmpire(5);
  editor.saveEmpire();
  assert.deepEqual(serialized(user.housingPlans), original.housingPlans);
  assert.equal(editor.trials[5].inputs.workers, 4);
});
test("direct free-trial loading needs neither market prices nor the node routing WASM", async () => {
  const user = { userWorkers: [], wasmRouting: true };
  const required = routeDataRequirements("/housecraft", user, {
    mode: "trial",
  });
  assert.equal(required.market, false);
  assert.equal(required.wasm, false);
  assert.equal(required.planner, true);
  const calls = [];
  await loadRouteData(
    "/housecraft",
    user,
    {
      fetchData: async () => calls.push("core"),
      fetchPlannerData: async () => calls.push("houses"),
      initWasmRouter: async () => calls.push("router"),
    },
    { fetchData: () => calls.push("market") },
    { mode: "trial" }
  );
  assert.deepEqual(calls, ["core", "houses"]);
  assert.equal(user.wasmRouting, true);
});

test("reading current housing needs does not write missing town capacities into saved user settings", () => {
  const source = readFileSync(
    new URL("../src/stores/user.js", import.meta.url),
    "utf8"
  )
    .replace(/^import[^\n]+\r?\n/gm, "")
    .replace("export const useUserStore", "const useUserStore");
  const options = vm.runInNewContext(source + "\nuseUserStore", {
    defineStore: (options) => options,
    useGameStore: () => ({}),
    useHousingStore: () => ({
      lookup: (tk, l, s) => ({
        success: true,
        cost: 0,
        wantLodging: l,
        wantStorage: s,
      }),
    }),
  });
  const user = {
    lodgingP2W: {},
    storageP2W: {},
    storagePersonal: {},
    warehouseRequirements: {},
    baseStorage: 8,
  };
  const original = serialized(user),
    result = options.getters.townInfra(user)(5, 4, 12);
  assert.equal(result.wantLodging, 3);
  assert.equal(result.wantStorage, 5);
  assert.deepEqual(user, original);
});
test("undoing a trial record cannot overwrite a later imported or externally edited record", () => {
  const { user, editor } = fixture();
  editor.deleteTrial(5);
  user.housingPlans[5] = { cost: 7 };
  assert.throws(() => editor.undoTrialRecord(5), /changed elsewhere/);
  assert.equal(user.housingPlans[5].cost, 7);
});
