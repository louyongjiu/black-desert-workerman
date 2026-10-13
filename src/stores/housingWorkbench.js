import { defineStore } from "pinia";
import { useGameStore } from "./game";
import { useUserStore } from "./user";
import { useHousingStore, housingRequest } from "./housing";
import { normalizeReservations, validateHousing } from "../housing/core.mjs";
import { fingerprint } from "../housing/requirements.mjs";
import { housingFromPlan } from "../housing/empire.mjs";
import {
  copy,
  defaultTrial,
  draftUser,
  empireTownSettings,
  empireTownSignature,
  trialDemand,
  trialUser,
} from "../housing/workbench.mjs";

export const useHousingWorkbenchStore = defineStore("housingWorkbench", {
  state: () => ({
    empire: {},
    trials: {},
    recordUndo: {},
    savedUndo: null,
    townKey: 5,
  }),
  actions: {
    ensureEmpire(tk) {
      const game = useGameStore(),
        user = useUserStore(),
        signature = empireTownSignature(game, user, tk);
      const old = this.empire[tk];
      if (!old || (!this.empireDirty(tk) && old.base !== signature))
        this.empire[tk] = {
          settings: empireTownSettings(game, user, tk),
          original: empireTownSettings(game, user, tk),
          base: signature,
          undo: null,
        };
      return this.empire[tk];
    },
    empireDirty(tk) {
      const entry = this.empire[tk];
      return Boolean(
        entry && fingerprint(entry.settings) !== fingerprint(entry.original)
      );
    },
    updateEmpire(tk, patch) {
      const entry = this.ensureEmpire(tk),
        settings = copy({ ...entry.settings, ...patch });
      const game = useGameStore(),
        user = useUserStore();
      const proposed = draftUser(game, user, {
        ...this.empire,
        [tk]: { settings },
      });
      normalizeReservations(game.houseInfo, proposed);
      const personal = settings.storagePersonal;
      if (
        personal !== null &&
        (!Number.isInteger(Number(personal)) || personal < 0 || personal > 192)
      )
        throw new Error(
          "Storage reservation must be a nonnegative whole number within the warehouse limit"
        );
      entry.undo = copy(entry.settings);
      entry.settings = settings;
    },
    resetEmpire(tk) {
      this.updateEmpire(tk, { houseReservations: {} });
    },
    undoEmpire(tk) {
      const entry = this.ensureEmpire(tk);
      if (entry.undo) {
        entry.settings = entry.undo;
        entry.undo = null;
      }
    },
    discardEmpire(tk) {
      delete this.empire[tk];
      this.ensureEmpire(tk);
    },
    saveEmpire() {
      const game = useGameStore(),
        user = useUserStore();
      const dirty = Object.keys(this.empire).filter((tk) =>
        this.empireDirty(tk)
      );
      const drafts = Object.fromEntries(
        dirty.map((tk) => [tk, this.empire[tk]])
      );
      for (const tk of dirty)
        if (this.empire[tk].base !== empireTownSignature(game, user, tk))
          throw new Error(
            "Empire housing changed elsewhere; reload the affected town draft"
          );
      const proposed = draftUser(game, user, drafts);
      normalizeReservations(game.houseInfo, proposed);
      const before = Object.fromEntries(
        dirty.map((tk) => [
          tk,
          { settings: empireTownSettings(game, user, tk) },
        ])
      );
      if (dirty.length) {
        user.$patch((state) => {
          state.houseReservations = copy(proposed.houseReservations);
          state.workshopStorage = copy(proposed.workshopStorage);
          state.storagePersonal = copy(proposed.storagePersonal);
        });
        this.savedUndo = {
          before,
          signatures: Object.fromEntries(
            dirty.map((tk) => [tk, empireTownSignature(game, user, tk)])
          ),
        };
      }
      for (const tk of dirty) {
        delete this.empire[tk];
        this.ensureEmpire(tk);
      }
    },
    undoSavedEmpire() {
      if (!this.savedUndo) return;
      const game = useGameStore(),
        user = useUserStore();
      for (const [tk, sig] of Object.entries(this.savedUndo.signatures))
        if (sig !== empireTownSignature(game, user, tk) || this.empireDirty(tk))
          throw new Error(
            "Empire housing changed elsewhere; reload the affected town draft"
          );
      const restored = draftUser(game, user, this.savedUndo.before);
      user.$patch((state) => {
        state.houseReservations = copy(restored.houseReservations);
        state.workshopStorage = copy(restored.workshopStorage);
        state.storagePersonal = copy(restored.storagePersonal);
      });
      for (const tk of Object.keys(this.savedUndo.before)) {
        delete this.empire[tk];
        this.ensureEmpire(tk);
      }
      this.savedUndo = null;
    },
    ensureTrial(tk) {
      if (!this.trials[tk])
        this.trials[tk] = {
          inputs: defaultTrial(useGameStore(), useUserStore(), tk),
          sourceKey: null,
          runInputs: null,
          initialResult: null,
          undo: null,
        };
      return this.trials[tk];
    },
    updateTrial(tk, patch) {
      const entry = this.ensureTrial(tk);
      entry.undo = copy({ ...entry, undo: null });
      entry.inputs = copy({ ...entry.inputs, ...patch });
    },
    resetTrial(tk) {
      const entry = this.ensureTrial(tk),
        old = copy({ ...entry, undo: null });
      if (entry.sourceKey && this.trialResult(tk)?.pending)
        useHousingStore().stop(entry.sourceKey);
      this.trials[tk] = {
        inputs: {
          ...defaultTrial(useGameStore(), useUserStore(), tk),
          workers: 0,
          storage: 0,
        },
        sourceKey: null,
        runInputs: null,
        initialResult: null,
        undo: old,
      };
    },
    undoTrial(tk) {
      const old = this.ensureTrial(tk).undo;
      if (old) this.trials[tk] = { ...old, undo: null };
    },
    copyEmpire(tk) {
      const game = useGameStore(),
        user = useUserStore();
      const source = housingFromPlan(
        useHousingStore().empireSource?.plan,
        tk,
        game,
        user
      );
      const inputs = defaultTrial(game, user, tk);
      // Copy saved empire settings, never unsaved drafts or live worker references.
      inputs.reservations = Object.fromEntries(
        Object.entries(normalizeReservations(game.houseInfo, user))
          .filter(([hk]) => Number(game.houseInfo[hk].affTown) === Number(tk))
          .map(([hk, value]) => [hk, { usage: value.usage }])
      );
      if (source) {
        inputs.workers = source.workerCount ?? inputs.workers;
        inputs.storage = source.storageCount ?? inputs.storage;
        inputs.freeBeds = Math.max(
          0,
          (source.baseLodging ?? inputs.freeBeds + inputs.paidBeds) -
            inputs.paidBeds
        );
        inputs.freeStorage = Math.max(
          0,
          (source.baseStorage ?? inputs.freeStorage + inputs.paidStorage) -
            inputs.paidStorage
        );
      }
      this.updateTrial(tk, inputs);
    },
    runTrial(tk) {
      const entry = this.ensureTrial(tk),
        game = useGameStore(),
        demand = trialDemand(entry.inputs);
      const request = housingRequest(
        game,
        trialUser(game, entry.inputs),
        tk,
        demand.wantLodging,
        demand.wantStorage,
        "trial"
      );
      const result = useHousingStore().calculateHousing(request);
      entry.runInputs = copy(entry.inputs);
      entry.sourceKey = request.key;
      entry.initialResult = copy(result);
    },
    trialResult(tk) {
      const entry = this.ensureTrial(tk);
      if (!entry.runInputs) return null;
      return {
        ...entry.initialResult,
        ...useHousingStore().results[entry.sourceKey],
        ...trialDemand(entry.runInputs),
        reservations: entry.runInputs.reservations,
      };
    },
    trialStale(tk) {
      const entry = this.ensureTrial(tk);
      return Boolean(
        entry.runInputs &&
          fingerprint(entry.inputs) !== fingerprint(entry.runInputs)
      );
    },
    saveTrial(tk) {
      const entry = this.ensureTrial(tk),
        plan = this.trialResult(tk),
        game = useGameStore(),
        housing = useHousingStore();
      if (
        !plan?.success ||
        this.trialStale(tk) ||
        housing.busyKey === entry.sourceKey
      )
        throw new Error("Housing settings changed; calculate again");
      const demand = trialDemand(entry.inputs),
        request = housingRequest(
          game,
          trialUser(game, entry.inputs),
          tk,
          demand.wantLodging,
          demand.wantStorage,
          "trial"
        );
      if (request.key !== entry.sourceKey)
        throw new Error("Housing settings changed; calculate again");
      validateHousing(
        game.houseInfo,
        tk,
        request.reservations,
        plan,
        demand.wantLodging,
        demand.wantStorage
      );
      const user = useUserStore();
      const before = copy(user.housingPlans[tk] ?? null);
      user.housingPlans[tk] = copy({
        ...plan,
        townKey: Number(tk),
        trialInputs: entry.inputs,
        savedAt: Date.now(),
      });
      this.recordUndo[tk] = {
        before,
        expected: fingerprint(user.housingPlans[tk]),
      };
    },
    loadTrial(tk) {
      const saved = useUserStore().housingPlans[tk];
      if (!saved) return;
      const inputs = saved.trialInputs || {
        ...defaultTrial(useGameStore(), useUserStore(), tk),
        workers:
          Number(saved.wantLodging || 0) +
          1 +
          Number(useUserStore().lodgingP2W[tk] || 0),
        storage: Math.min(
          192,
          Number(saved.wantStorage || 0) +
            Number(useUserStore().baseStorage || 0) +
            Number(useUserStore().storageP2W[tk] || 0)
        ),
        reservations: Object.fromEntries(
          Object.entries(saved.reservations || {}).map(([hk, r]) => [
            hk,
            { usage: r.usage },
          ])
        ),
      };
      this.updateTrial(tk, inputs);
    },
    deleteTrial(tk) {
      const user = useUserStore();
      this.recordUndo[tk] = {
        before: copy(user.housingPlans[tk] ?? null),
        expected: fingerprint(null),
      };
      delete user.housingPlans[tk];
    },
    undoTrialRecord(tk) {
      if (!(tk in this.recordUndo)) return;
      const user = useUserStore();
      const undo = this.recordUndo[tk];
      if (undo.expected !== fingerprint(user.housingPlans[tk] ?? null))
        throw new Error(
          "Saved trial changed elsewhere; reload its inputs before editing"
        );
      if (undo.before === null) delete user.housingPlans[tk];
      else user.housingPlans[tk] = copy(undo.before);
      delete this.recordUndo[tk];
    },
  },
});
