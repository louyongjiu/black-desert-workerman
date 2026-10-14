import assert from "node:assert/strict";
import { realGame } from "../tests/helpers/realGame.mjs";
import { prepareValues as referenceValues } from "../tests/fixtures/referenceValues.mjs";
import {
  createPreparationCache,
  prepareValues,
} from "../src/optimizer/values.mjs";
import { createSnapshot } from "../src/optimizer/snapshot.mjs";

const { game, user, market, dispose } = await realGame();
const options = {
  townIds: [...game.townsWithLodging],
  budget: 300,
  timeLimit: 30,
  maxPlantzones: 370,
  storageTown: 601,
  includeGrind: true,
};
const median = (samples) =>
  [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
const timed = (fn) => {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
};
try {
  for (const floating of [false, true]) {
    const snapshot = createSnapshot(game, user, market, {
      ...options,
      townIds: floating ? options.townIds.slice(0, 6) : options.townIds,
      maxPlantzones: floating ? 40 : 370,
    });
    if (floating)
      for (const r of Object.values(snapshot.resources))
        Object.assign(r, {
          floating: true,
          times: { 0: 100, 30: 75, 50: 50, 80: 25, 100: 0 },
        });
    const before = [],
      cold = [],
      warm = [];
    for (let i = 0; i < 3; i++) {
      const baseline = timed(() => referenceValues(snapshot));
      const cache = createPreparationCache();
      const first = timed(() => prepareValues(snapshot, undefined, cache));
      const repeat = timed(() =>
        prepareValues({ ...snapshot, timeLimit: 60 }, undefined, cache)
      );
      assert.equal(JSON.stringify(first.value), JSON.stringify(baseline.value));
      assert.equal(
        JSON.stringify(repeat.value),
        JSON.stringify(baseline.value)
      );
      before.push(baseline.ms);
      cold.push(first.ms);
      warm.push(repeat.ms);
    }
    console.log(
      JSON.stringify({
        scenario: floating
          ? "floating-6-towns-40-nodes"
          : "static-31-towns-370-nodes",
        beforeMs: median(before),
        coldMs: median(cold),
        warmMs: median(warm),
        identical: true,
      })
    );
  }
  const before = [],
    after = [];
  let full, input;
  for (let i = 0; i < 5; i++) {
    const baseline = timed(() => createSnapshot(game, user, market, options));
    const packet = timed(() =>
      createSnapshot(game, user, market, options, undefined, true)
    );
    before.push(baseline.ms);
    after.push(packet.ms);
    full = baseline.value;
    input = packet.value;
  }
  console.log(
    JSON.stringify({
      scenario: "main-thread-snapshot",
      beforeMs: median(before),
      afterMs: median(after),
      beforeBytes: Buffer.byteLength(JSON.stringify(full)),
      afterBytes: Buffer.byteLength(JSON.stringify(input)),
    })
  );
} finally {
  dispose();
}
