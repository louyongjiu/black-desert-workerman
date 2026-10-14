import assert from "node:assert/strict";
import test from "node:test";
import { markRaw } from "vue";
import { realGame } from "./helpers/realGame.mjs";
import { configurationSignature } from "../src/optimizer/snapshot.mjs";
import { planningDataSignature } from "../src/housing/requirements.mjs";
import { frameUpdates } from "../src/ui/frameUpdates.mjs";
import { workerKey } from "../src/ui/workerKeys.mjs";

test("one cached signature serves all towns and observes nested edits and data replacement", async (t) => {
  let calls = 0;
  const { game, user, dispose } = await realGame((state) => {
    calls++;
    return configurationSignature(state);
  });
  t.after(dispose);
  user.userWorkers = Array.from({ length: 200 }, (_, i) => ({
    tnk: 1,
    level: 40,
    label: "Worker " + i,
    skills: ["1012"],
    job: null,
  }));
  user.optimizerPlan = {
    appliedSignature: configurationSignature(user),
    dataSignature: planningDataSignature(game),
  };
  calls = 0;
  for (let i = 0; i < 31; i++) assert.equal(user.housingPlanValid, true);
  assert.equal(calls, 1);
  user.userWorkers[0].skills.push("1301");
  assert.equal(user.housingPlanValid, false);
  assert.equal(calls, 2);
  user.optimizerPlan.appliedSignature = configurationSignature(user);
  assert.equal(user.housingPlanValid, true);
  assert.equal(calls, 2);
  user.customPrices[7001] = 12345;
  assert.equal(user.housingPlanValid, true);
  assert.equal(calls, 2);
  game.nodes = markRaw({ ...game.nodes, 1: { ...game.nodes[1], CP: 1 } });
  assert.equal(user.housingPlanValid, false);
  assert.equal(calls, 2);
});

test("worker grouping and UI identities survive edits and update after a town move", async (t) => {
  const { game, user, dispose } = await realGame();
  t.after(dispose);
  user.userWorkers = [
    { tnk: 1, label: "same" },
    { tnk: 1, label: "same" },
  ];
  const [a, b] = user.userWorkers,
    key = workerKey(a),
    group = user.townWorkers(game.tnk2tk(1));
  assert.notEqual(key, workerKey(b));
  a.label = "changed";
  assert.equal(workerKey(a), key);
  assert.equal(user.townWorkers(game.tnk2tk(1)), group);
  a.tnk = 61;
  assert.deepEqual([...user.townWorkers(game.tnk2tk(1))], [b]);
  assert.deepEqual([...user.townWorkers(game.tnk2tk(61))], [a]);
});

test("map updates coalesce within a frame and pending work can be cancelled on unmount", () => {
  const callbacks = new Map();
  let id = 0,
    updates = 0;
  const schedule = frameUpdates(
    () => updates++,
    (callback) => {
      callbacks.set(++id, callback);
      return id;
    },
    (key) => callbacks.delete(key)
  );
  schedule();
  schedule();
  schedule();
  assert.equal(callbacks.size, 1);
  callbacks.get(id)();
  callbacks.delete(id);
  assert.equal(updates, 1);
  schedule();
  schedule.cancel();
  assert.equal(callbacks.size, 0);
  assert.equal(updates, 1);
});
