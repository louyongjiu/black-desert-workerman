import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { createPinia, defineStore } from "pinia";
import { markRaw } from "vue";
import { localizeGameLanguage } from "../../src/i18n/game.mjs";
import { translate } from "../../src/i18n/index.mjs";
import { DATASET_GROUPS } from "../../src/dataLoading.mjs";
import {
  buildDistanceIndex,
  medianWorkerStats,
} from "../../src/gameLookups.mjs";
import { binarySearch, searchSorted, formatFixed } from "../../src/util.js";
import { cyclesDaily } from "../../src/optimizer/calculations.mjs";
import { configurationSignature } from "../../src/optimizer/snapshot.mjs";
import { appliedRouting } from "../../src/optimizer/appliedRouting.mjs";
import { normalizeReservations } from "../../src/housing/core.mjs";
import {
  employeeCounts,
  storageRequirements,
} from "../../src/housing/requirements.mjs";
import {
  validAppliedPlan,
  housingFromPlan,
} from "../../src/housing/empire.mjs";

// Real data and actual Pinia caching; network and market values are deterministic.
export async function realGame(signature = configurationSignature) {
  const read = (file) =>
    JSON.parse(readFileSync(new URL("../../" + file, import.meta.url)));
  const source = (name, symbol) =>
    readFileSync(new URL("../../src/stores/" + name, import.meta.url), "utf8")
      .replace(/^import .*\r?\n/gm, "")
      .replace("export const " + symbol, "const " + symbol) +
    "\n" +
    symbol;
  let game, user;
  const pinia = createPinia();
  const prices = Object.fromEntries(
    Object.values(read("data/manual/plantzone_drops.json")).flatMap((drop) =>
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
  const createUser = vm.runInNewContext(source("user.js", "useUserStore"), {
    defineStore,
    useGameStore: () => game,
    useRoutingStore: () => ({ routing: appliedRouting(user, game) }),
    useHousingStore: () => ({
      lookup(tk, l, s) {
        if (user.housingPlanValid) {
          const plan = housingFromPlan(user.optimizerPlan, tk, game, user);
          if (
            plan &&
            Math.max(0, plan.wantLodging) === Math.max(0, l) &&
            Math.max(0, plan.wantStorage) === Math.max(0, s)
          )
            return plan;
        }
        return game.lsLookup(tk, l, s);
      },
    }),
    calculateCyclesDaily: cyclesDaily,
    configurationSignature: signature,
    normalizeReservations,
    employeeCounts,
    storageRequirements,
    validAppliedPlan,
    translate,
    searchSorted,
    formatFixed,
    console: { log() {} },
  });
  user = createUser(pinia);
  const createGame = vm.runInNewContext(source("game.js", "useGameStore"), {
    defineStore,
    markRaw,
    localizeGameLanguage,
    useUserStore: () => user,
    useMarketStore: () => market,
    buildDistanceIndex,
    medianWorkerStats,
    binarySearch,
    Heap: createRequire(import.meta.url)("heap"),
    console: { log() {} },
    fetchJson: async (file) => read(file),
    loadGameDatasets: async (group) =>
      Object.fromEntries(
        Object.entries(DATASET_GROUPS[group]).map(([key, file]) => [
          key,
          read(file),
        ])
      ),
  });
  game = createGame(pinia);
  await game.fetchPlannerData();
  return { game, user, market, dispose: () => pinia._e.stop() };
}
