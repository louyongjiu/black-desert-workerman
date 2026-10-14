import assert from "node:assert/strict";
import test from "node:test";
import {
  housingTownKeys,
  empireHousingTown,
  summarizeHousing,
  housingRows,
} from "../src/housing/overview.mjs";

const game = {
  houseInfo: {
    101: { key: 101, affTown: 1, CP: 2, CraftList: { 1: 2 } },
    201: { key: 201, affTown: 2, CP: 1, CraftList: { 2: 2 } },
  },
  tnk2tk: (node) => node / 10,
  townsWithLodging: [10, 20],
  townsWithRedirectableStorage: [10, 20, 30],
};
const user = { baseStorage: 8, lodgingP2W: { 1: 2 }, storageP2W: { 2: 16 } };

test("all towns includes storage-only towns and every town in the selected plan", () => {
  assert.deepEqual(
    housingTownKeys(game, { housing: [{ townKey: 4 }] }, { 5: 2 }, { 6: {} }),
    [1, 2, 3, 4, 5, 6]
  );
});

test("all-town totals use full housing costs and cap each warehouse separately", () => {
  const infrastructure = (key) =>
    ({
      1: {
        success: true,
        cost: 4,
        totalCost: 7,
        lodging: 2,
        storage: 8,
        indices: [101],
        states: [2],
      },
      2: {
        success: true,
        cost: 1,
        lodging: 1,
        storage: 180,
        indices: [201],
        states: [1],
      },
    }[key]);
  const options = {
    infrastructure,
    workers: { 1: 4, 2: 2 },
    warehouses: { 1: { total: 10 }, 2: { total: 190 } },
  };
  const views = [1, 2, 3].map((key) =>
    empireHousingTown(game, user, key, options)
  );
  assert.equal(views[1].totalStorage, 192);
  const totals = summarizeHousing(views);
  assert.deepEqual(totals, {
    pending: 0,
    failed: 0,
    cost: 8,
    workers: 6,
    storage: 200,
    totalBeds: 8,
    totalStorage: 216,
  });
  assert.equal(views[0].result.cost, 7);
  assert.equal(housingRows(game, views[0].result)[0].usage, 1);
});

test("a preview replaces old town demands, including towns omitted by that preview", () => {
  const plan = {
    schemaVersion: 2,
    housing: [
      {
        townKey: 2,
        cost: 5,
        workerCount: 4,
        storageCount: 7,
        baseLodging: 1,
        baseStorage: 8,
        houseLodging: 3,
        houseStorage: 0,
        indices: [201],
        states: [0],
        usages: [0],
      },
    ],
  };
  const options = {
    plan,
    workers: { 1: 99, 2: 77 },
    warehouses: { 1: { total: 150 }, 2: { total: 100 } },
    infrastructure() {
      throw new Error("Must not read the old live infrastructure");
    },
  };
  const absent = empireHousingTown(game, user, 1, options);
  const present = empireHousingTown(game, user, 2, options);
  assert.equal(absent.demand.workers, 0);
  assert.equal(absent.demand.storage, 0);
  assert.equal(absent.result.cost, 0);
  assert.equal(present.demand.workers, 4);
  assert.equal(present.demand.storage, 7);
  assert.equal(present.totalStorage, 8);
  assert.equal(summarizeHousing([absent, present]).cost, 5);
});

test("pending or failed towns leave aggregate cost and availability unknown, rather than showing a partial total", () => {
  const pending = empireHousingTown(game, user, 1, {
    workers: { 1: 4 },
    infrastructure: () => ({
      success: false,
      pending: true,
      cost: NaN,
      lodging: NaN,
      storage: NaN,
      indices: [],
      states: [],
    }),
  });
  const ready = empireHousingTown(game, user, 2);
  let totals = summarizeHousing([pending, ready]);
  assert.equal(totals.pending, 1);
  assert.equal(totals.workers, 4);
  assert.equal(totals.cost, null);
  assert.equal(totals.totalBeds, null);
  const failed = empireHousingTown(game, user, 1, {
    infrastructure: () => {
      throw new Error("Invalid storage demand");
    },
  });
  totals = summarizeHousing([failed, ready]);
  assert.equal(totals.failed, 1);
  assert.equal(totals.cost, null);
  assert.equal(failed.result.error, "Invalid storage demand");
});
