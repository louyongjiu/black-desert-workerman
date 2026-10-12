import { defineStore } from "pinia";
import { useGameStore } from "./game";
import { useUserStore } from "./user";
import {
  normalizeReservations,
  townHouses,
  townReservations,
  validateHousing,
} from "../housing/core.mjs";

const runtimes = new WeakMap();
const plain = (value) => JSON.parse(JSON.stringify(value));
const townData = new WeakMap();
function runtime(store) {
  if (!runtimes.has(store.$state))
    runtimes.set(store.$state, {
      worker: null,
      active: null,
      queue: new Map(),
      contexts: new Map(),
    });
  return runtimes.get(store.$state);
}
export function housingRequest(game, user, townKey, wantLodging, wantStorage) {
  const beds = Math.max(0, Math.ceil(Number(wantLodging))),
    storage = Math.max(0, Math.ceil(Number(wantStorage)));
  if (
    !Number.isFinite(beds) ||
    !Number.isFinite(storage) ||
    beds > 1000 ||
    storage > 2000
  )
    throw new Error("Housing demand is invalid");
  const reservations = townReservations(
    game.houseInfo,
    user.housingReservations || normalizeReservations(game.houseInfo, user),
    townKey
  );
  if (!townData.has(game.houseInfo)) townData.set(game.houseInfo, new Map());
  const towns = townData.get(game.houseInfo);
  if (!towns.has(Number(townKey))) {
    const houses = Object.fromEntries(
      townHouses(game.houseInfo, townKey).map((h) => [h.key, h])
    );
    towns.set(Number(townKey), {
      houses: plain(houses),
      signature: JSON.stringify(
        Object.values(houses).map((h) => [
          h.key,
          h.CP,
          h.needHouseKey,
          h.CraftList,
        ])
      ),
    });
  }
  const { houses, signature } = towns.get(Number(townKey));
  const context = JSON.stringify([signature, reservations]);
  const key = JSON.stringify([Number(townKey), beds, storage, context]);
  return {
    townKey: Number(townKey),
    wantLodging,
    wantStorage,
    reservations,
    houses,
    context,
    key,
  };
}
export const useHousingStore = defineStore("housing", {
  state: () => ({ results: {}, busyKey: null }),
  actions: {
    lookup(townKey, wantLodging, wantStorage, priority = 0) {
      townKey = Number(townKey);
      const game = useGameStore(),
        user = useUserStore();
      const empty = {
        wantLodging,
        wantStorage,
        success: false,
        pending: false,
        cost: NaN,
        lodging: NaN,
        storage: NaN,
        indices: [],
        states: [],
      };
      if (!game.plannerReady) return empty;
      let request;
      try {
        request = housingRequest(game, user, townKey, wantLodging, wantStorage);
      } catch (error) {
        return { ...empty, error: error.message };
      }
      const saved = user.housingPlans?.[townKey];
      if (saved?.sourceKey === request.key) {
        try {
          validateHousing(
            game.houseInfo,
            townKey,
            request.reservations,
            saved,
            wantLodging,
            wantStorage
          );
          return { ...saved, wantLodging, wantStorage };
        } catch {
          /* A data update invalidates saved selections. */
        }
      }
      if (!Object.keys(request.reservations).length) {
        return {
          ...game.lsLookup(townKey, wantLodging, wantStorage),
          workshopCP: 0,
          sourceKey: request.key,
          townKey: Number(townKey),
          status: "optimal",
        };
      }
      if (this.results[request.key])
        return {
          ...empty,
          ...this.results[request.key],
          wantLodging,
          wantStorage,
          sourceKey: request.key,
        };
      const rt = runtime(this);
      if (rt.contexts.get(townKey) !== request.context) {
        rt.contexts.set(townKey, request.context);
        for (const [key, job] of rt.queue)
          if (job.townKey === Number(townKey)) rt.queue.delete(key);
      }
      if (rt.active?.key !== request.key) {
        const old = rt.queue.get(request.key);
        if (rt.queue.size < 128 || priority > 0 || old)
          rt.queue.set(request.key, {
            ...request,
            priority: Math.max(priority, old?.priority || 0),
          });
        queueMicrotask(() => this.pump());
      }
      return { ...empty, pending: true, sourceKey: request.key };
    },
    pump() {
      const rt = runtime(this);
      if (rt.active || !rt.queue.size) return;
      if (!rt.worker) {
        rt.worker = new Worker(
          new URL("../housing/solve.worker.mjs", import.meta.url),
          { type: "module" }
        );
        const worker = rt.worker;
        rt.worker.onmessage = ({ data }) => {
          if (rt.worker !== worker || data.key !== rt.active?.key) return;
          const job = rt.active;
          if (rt.contexts.get(job.townKey) === job.context) {
            this.results[data.key] =
              data.type === "error"
                ? {
                    success: false,
                    pending: false,
                    cost: NaN,
                    lodging: NaN,
                    storage: NaN,
                    indices: [],
                    states: [],
                    error: data.message,
                  }
                : { ...data.result, pending: false };
          }
          if (data.type === "solution") return;
          rt.active = null;
          this.busyKey = null;
          this.pump();
        };
        rt.worker.onerror = (event) => {
          if (rt.worker !== worker) return;
          if (rt.active)
            this.results[rt.active.key] = {
              success: false,
              pending: false,
              cost: NaN,
              lodging: NaN,
              storage: NaN,
              indices: [],
              states: [],
              error: event.message || "Housing solver could not be loaded",
            };
          rt.worker.terminate();
          rt.worker = null;
          rt.active = null;
          this.busyKey = null;
          this.pump();
        };
      }
      const job = [...rt.queue.values()].sort(
        (a, b) => b.priority - a.priority
      )[0];
      rt.queue.delete(job.key);
      rt.active = job;
      this.busyKey = job.key;
      rt.worker.postMessage(job);
    },
    stop(key) {
      const rt = runtime(this);
      rt.queue.delete(key);
      const best = this.results[key];
      this.results[key] = best?.success
        ? { ...best, status: "stopped" }
        : {
            success: false,
            pending: false,
            cost: NaN,
            lodging: NaN,
            storage: NaN,
            indices: [],
            states: [],
            sourceKey: key,
            error: "Housing calculation stopped",
          };
      if (rt.active?.key !== key) return;
      rt.worker.terminate();
      rt.worker = null;
      rt.active = null;
      this.busyKey = null;
      this.pump();
    },
    retry(key) {
      delete this.results[key];
    },
    reserve(houseKey, usage) {
      const user = useUserStore(),
        game = useGameStore();
      const reservations = plain(user.houseReservations);
      if (usage === "") delete reservations[houseKey];
      else reservations[houseKey] = { usage: Number(usage) };
      normalizeReservations(game.houseInfo, {
        houseReservations: reservations,
        userWorkers: user.userWorkers,
      });
      user.housingUndo = plain({
        houseReservations: user.houseReservations,
        housingPlans: user.housingPlans,
      });
      user.houseReservations = reservations;
    },
    save(plan) {
      const user = useUserStore(),
        game = useGameStore();
      const request = housingRequest(
        game,
        user,
        plan.townKey,
        plan.wantLodging,
        plan.wantStorage
      );
      if (!plan.success || request.key !== plan.sourceKey)
        throw new Error("Housing settings changed; calculate again");
      validateHousing(
        game.houseInfo,
        plan.townKey,
        request.reservations,
        plan,
        plan.wantLodging,
        plan.wantStorage
      );
      user.housingUndo = plain({
        houseReservations: user.houseReservations,
        housingPlans: user.housingPlans,
      });
      user.housingPlans[plan.townKey] = plain(plan);
    },
    undo() {
      const user = useUserStore();
      if (!user.housingUndo) return;
      const backup = plain(user.housingUndo);
      user.houseReservations = backup.houseReservations;
      user.housingPlans = backup.housingPlans;
      user.housingUndo = null;
    },
    clearReservations() {
      const user = useUserStore();
      user.housingUndo = plain({
        houseReservations: user.houseReservations,
        housingPlans: user.housingPlans,
      });
      user.houseReservations = {};
    },
  },
});
