import assert from "node:assert/strict";
import test from "node:test";
import { parseImport } from "../src/ui/imports.mjs";
import { snapshotFields, canRestore, restorePatch } from "../src/ui/undo.mjs";
import {
  projectHousingDrafts,
  readHousingDrafts,
} from "../src/housing/drafts.mjs";

const worker = {
  charkey: 7572,
  tnk: 1,
  label: "worker",
  level: 40,
  wspdSheet: 150,
  mspdSheet: 10,
  luckSheet: 10,
  skills: [],
  job: null,
};
function fixture() {
  return {
    userWorkers: [worker],
    customPrices: { 4001: 100 },
    keepItems: {},
    regionResources: {},
    regionResources2: {},
    allowFloating: false,
    useFloatingResources: {},
    optimizerPlan: null,
    optimizerUndo: null,
    selectedTax: 0.65,
    farmingProfit: 0,
    farmingBareProfit: 3,
    mapHideInactive: 0,
    userWorkshops: {},
  };
}

test("import rejects malformed and unsafe input before live data changes", () => {
  const state = fixture(),
    initial = structuredClone(state);
  for (const text of [
    "{",
    "[]",
    "null",
    '{"customPrices":null}',
    '{"keepItems":{"4001":"false"}}',
    '{"customPrices":{"4001":-1}}',
    '{"customPrices":{"__proto__":{}}}',
  ]) {
    assert.throws(() => parseImport(text, "prices", state));
    assert.deepEqual(state, initial);
  }
  assert.throws(() =>
    parseImport(
      JSON.stringify({ userWorkers: [{ ...worker, level: 400 }] }),
      "empire",
      state
    )
  );
  assert.throws(() =>
    parseImport(
      JSON.stringify({ userWorkers: [worker], userWorkshops: { 1: null } }),
      "empire",
      state
    )
  );
});

test("price imports preserve empty replacement maps, zero values and unrelated settings", () => {
  const state = fixture();
  assert.deepEqual(
    parseImport(
      JSON.stringify({
        userWorkers: [],
        customPrices: { 4001: 0 },
        keepItems: {},
        optimizerUndo: {},
      }),
      "prices",
      state
    ),
    { customPrices: { 4001: 0 }, keepItems: {} }
  );
  assert.deepEqual(parseImport('{"customPrices":{}}', "prices", state), {
    customPrices: {},
  });
  assert.deepEqual(
    parseImport('{"customPrices":{"4001":"","4002":null}}', "prices", state),
    { customPrices: { 4001: "", 4002: "" } }
  );
  const legacy = parseImport(
    '{"farmingWorkerSilverPerDay":2000000}',
    "prices",
    state
  );
  assert.equal(legacy.farmingProfit, 23);
});

test("empire backup accepts farming jobs and existing checkbox formats without importing undo state", () => {
  const state = fixture();
  const patch = parseImport(
    JSON.stringify({
      userWorkers: [{ ...worker, job: "farming" }],
      mapHideInactive: true,
      optimizerUndo: { userWorkers: [] },
    }),
    "empire",
    state
  );
  assert.equal(patch.userWorkers[0].job, "farming");
  assert.equal(patch.mapHideInactive, true);
  assert.ok(!("optimizerUndo" in patch));
});

test("resource imports migrate both historical formats and validate percentages", () => {
  const state = fixture();
  assert.deepEqual(
    parseImport(
      '{"regionModifiers":{"1":50},"regionModifiers2":{"2":["0",100]}}',
      "resources",
      state
    ),
    { regionResources: { 1: 50 }, regionResources2: { 2: ["0", 100] } }
  );
  assert.throws(() =>
    parseImport('{"regionResources":{"1":101}}', "resources", state)
  );
  assert.throws(() =>
    parseImport('{"regionResources2":{"1":[-1]}}', "resources", state)
  );
});

test("undo restores only affected fields and refuses to overwrite later edits", () => {
  const state = fixture();
  const before = snapshotFields(state, ["userWorkers"]);
  state.userWorkers = [];
  const record = { before, after: snapshotFields(state, ["userWorkers"]) };
  state.customPrices[4001] = 999;
  assert.equal(canRestore(record, state), true);
  Object.assign(state, restorePatch(record, state));
  assert.equal(state.userWorkers.length, 1);
  assert.equal(state.customPrices[4001], 999);
  state.userWorkers = [{ ...worker, label: "later edit" }];
  assert.equal(canRestore(record, state), false);
  assert.throws(() => restorePatch(record, state));
});

test("housing drafts survive refresh without restoring handles to old solver workers", () => {
  const state = {
    townKey: 5,
    empire: {
      5: {
        settings: { houseReservations: { 1: { usage: 0 } } },
        original: { houseReservations: {} },
        base: "signature",
        undo: null,
      },
    },
    trials: {
      6: {
        inputs: { workers: 4, storage: 12 },
        sourceKey: "old-worker-key",
        runInputs: {},
        initialResult: { pending: true },
        undo: {},
      },
    },
    savedUndo: null,
    recordUndo: {},
  };
  const restored = readHousingDrafts(
    JSON.stringify(projectHousingDrafts(state))
  );
  assert.deepEqual(restored.empire, state.empire);
  assert.deepEqual(restored.trials[6].inputs, state.trials[6].inputs);
  assert.equal(restored.trials[6].sourceKey, null);
  assert.equal(restored.trials[6].initialResult, null);
  assert.equal(state.trials[6].sourceKey, "old-worker-key");
  assert.throws(() =>
    readHousingDrafts('{"version":1,"empire":[],"trials":{}}')
  );
  assert.throws(() =>
    readHousingDrafts('{"version":1,"empire":{},"trials":{"5":{}}}')
  );
});
