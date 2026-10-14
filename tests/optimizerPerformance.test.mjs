import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { realGame } from "./helpers/realGame.mjs";
import { createSnapshot } from "../src/optimizer/snapshot.mjs";
import {
  createPreparationCache,
  prepareValues,
} from "../src/optimizer/values.mjs";
import { prepareValues as referenceValues } from "./fixtures/referenceValues.mjs";
import {
  loadOptimizerData,
  optimizerSession,
} from "../src/optimizer/transport.mjs";
import { OptimizerClient } from "../src/optimizer/client.mjs";

const plain = (value) => JSON.parse(JSON.stringify(value));
const options = {
  townIds: [1],
  budget: 300,
  timeLimit: 30,
  maxPlantzones: 20,
  storageTown: 601,
  includeGrind: true,
};

test("all-town static and floating candidates exactly match the original search", async (t) => {
  const { game, user, market, dispose } = await realGame();
  t.after(dispose);
  const staticSnapshot = createSnapshot(game, user, market, {
    ...options,
    townIds: [...game.townsWithLodging],
    maxPlantzones: 370,
  });
  assert.deepEqual(
    plain(prepareValues(staticSnapshot)),
    plain(referenceValues(staticSnapshot))
  );
  const floating = createSnapshot(game, user, market, {
    ...options,
    townIds: game.townsWithLodging.slice(0, 6),
    maxPlantzones: 40,
  });
  for (const r of Object.values(floating.resources))
    Object.assign(r, {
      floating: true,
      times: { 0: 100, 30: 75, 50: 50, 80: 25, 100: 0 },
    });
  assert.deepEqual(
    plain(prepareValues(floating)),
    plain(referenceValues(floating))
  );
});

test("valuation caches handle budget, prices, resources, templates and data replacement without exposing saved skills", async (t) => {
  const { game, user, market, dispose } = await realGame();
  t.after(dispose);
  const snapshot = createSnapshot(game, user, market, options);
  const cache = createPreparationCache(400);
  const check = () =>
    assert.deepEqual(
      plain(prepareValues(snapshot, undefined, cache)),
      plain(referenceValues(snapshot))
    );
  check();
  const first = prepareValues(snapshot, undefined, cache);
  first.candidates[0].worker.skills.length = 0;
  check();
  snapshot.budget = 20;
  snapshot.maxPlantzones = 10;
  check();
  snapshot.budget = 300;
  for (const key of Object.keys(snapshot.prices)) snapshot.prices[key] *= 1.5;
  check();
  snapshot.prices[Object.keys(snapshot.prices)[0]] = null;
  check();
  for (const r of Object.values(snapshot.resources)) r.productivity = 0.4;
  check();
  for (const worker of snapshot.townTemplates[1]) {
    worker.wspd += 10;
    worker.mspd += 2;
  }
  check();
  snapshot.nodes = { ...snapshot.nodes };
  check();
  assert.ok(cache.candidates.size <= cache.limit);
});

test("small transport snapshots restore the exact data, load it once and reject an inconsistent version", async (t) => {
  const { game, user, market, dispose } = await realGame();
  t.after(dispose);
  t.mock.method(globalThis, "fetch", async (url) => ({
    ok: true,
    json: async () =>
      JSON.parse(
        readFileSync(
          new URL("../" + url.replace("/workerman/", ""), import.meta.url)
        )
      ),
  }));
  const full = createSnapshot(game, user, market, options);
  const input = createSnapshot(game, user, market, options, undefined, true);
  const data = await loadOptimizerData(input.resources);
  full.createdAt = input.params.createdAt;
  assert.deepEqual(plain({ ...data, ...input.params }), full);
  assert.ok(JSON.stringify(input).length < JSON.stringify(full).length / 10);
  let loads = 0,
    solvers = 0;
  const run = optimizerSession(
    async () => {
      solvers++;
      return "solver";
    },
    (solver, snapshot) => {
      assert.equal(solver, "solver");
      return snapshot.budget;
    },
    async () => {
      loads++;
      return data;
    }
  );
  assert.equal(await run(input, () => {}), 300);
  input.params.budget = 200;
  assert.equal(await run(input, () => {}), 200);
  assert.equal(loads, 1);
  assert.equal(solvers, 1);
  await assert.rejects(
    run({ ...input, dataVersion: "different" }, () => {}),
    /Game data changed/
  );
});

test("idle worker reuse ignores stale runs, stops active work and releases idle resources", async (t) => {
  const workers = [],
    events = [];
  const client = new OptimizerClient(
    () => {
      const worker = {
        terminate() {
          this.terminated = true;
        },
        postMessage(input) {
          this.input = input;
        },
      };
      workers.push(worker);
      return worker;
    },
    (event) => events.push(event),
    5
  );
  t.after(() => client.stop(false));
  client.start({ budget: 1 });
  const worker = workers[0],
    oldId = worker.input.runId;
  worker.onmessage({ data: { runId: oldId, type: "complete" } });
  client.start({ budget: 2 });
  assert.equal(workers.length, 1);
  worker.onmessage({ data: { runId: oldId, type: "solution" } });
  assert.equal(events.length, 1);
  client.stop();
  assert.ok(worker.terminated);
  client.start({ budget: 3 });
  workers[1].onmessage({
    data: { runId: workers[1].input.runId, type: "complete" },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(workers[1].terminated);
});
