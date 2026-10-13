import { defineStore } from "pinia";
import { useGameStore } from "./game";
import { useUserStore } from "./user";
import { useMarketStore } from "./market";
import { useRoutingStore } from "./routing";
import { mergeEmpire } from "../optimizer/application.mjs";
import { planningDataSignature } from "../housing/requirements.mjs";
import {
  createSnapshot,
  configurationSignature,
  valuationSignature,
  canReplaceGatheringWorkers,
} from "../optimizer/snapshot.mjs";
import { OptimizerClient } from "../optimizer/client.mjs";

const clients = new WeakMap();
const plain = (value) => JSON.parse(JSON.stringify(value));

export const useOptimizerStore = defineStore("optimizer", {
  state: () => ({
    running: false,
    stage: "",
    result: null,
    error: "",
    startedAt: 0,
    progress: {},
    lastOptions: null,
    draftOptions: null,
  }),
  actions: {
    start(options) {
      if (this.running) return;
      try {
        if (useUserStore().wasmRouting && !useGameStore().wasmRouter)
          throw new Error(
            "Route planner is still loading; start again when ready"
          );
        const snapshot = createSnapshot(
          useGameStore(),
          useUserStore(),
          useMarketStore(),
          options,
          useRoutingStore().routing
        );
        let client = clients.get(this.$state);
        if (!client) {
          client = new OptimizerClient(
            () =>
              new Worker(
                new URL("../optimizer/solve.worker.mjs", import.meta.url),
                { type: "module" }
              ),
            (message) => {
              if (message.type === "progress") {
                this.progress = message;
                this.stage = message.stage;
              }
              if (message.type === "solution" || message.type === "complete")
                this.result = message.result;
              if (message.type === "error") this.error = message.message;
              if (["complete", "error", "stopped"].includes(message.type)) {
                this.running = false;
                this.stage = message.type;
                if (message.type === "stopped" && this.result)
                  this.result.status = "stopped";
              }
            }
          );
          clients.set(this.$state, client);
        }
        this.lastOptions = plain(options);
        this.running = true;
        this.error = "";
        this.result = null;
        this.progress = {};
        this.stage = "loading";
        this.startedAt = Date.now();
        client.start(snapshot);
      } catch (error) {
        this.error = error.message;
        this.running = false;
      }
    },
    stop() {
      clients.get(this.$state)?.stop();
    },
    apply(allowEmpty = false) {
      const user = useUserStore();
      if (this.running || !this.result)
        throw new Error("请等待优化完成或先停止计算");
      if (this.result.sourceSignature !== configurationSignature(user))
        throw new Error("工人或基础设施设置已变化，请重新优化");
      if (
        this.result.valueSignature !==
        valuationSignature(user, useMarketStore())
      )
        throw new Error("价格或资源设置已变化，请重新优化");
      if (!canReplaceGatheringWorkers(user))
        throw new Error(
          "This empire contains unsupported active tasks; export a preview instead"
        );
      if (
        this.result.dataSignature &&
        this.result.dataSignature !== planningDataSignature(useGameStore())
      )
        throw new Error("Game data changed; optimize again");
      const merged = mergeEmpire(user, this.result, allowEmpty);
      const plan = plain(this.result);
      const backup = plain({
        userWorkers: user.userWorkers,
        grindTakenList: user.grindTakenList,
        activateAncado: user.activateAncado,
        optimizerPlan: user.optimizerPlan,
      });
      plan.fixedWorkerBindings = merged.bindings;
      const activateAncado =
        plan.assignments.some((a) => a.town === 1343) ||
        plan.storageTown === 1343 ||
        plan.fixedWorkshopRoutes?.some(
          (r) => r.source === 1343 || r.target === 1343
        ) ||
        user.activateAncado;
      user.$patch((state) => {
        state.optimizerUndo = backup;
        state.userWorkers = merged.workers;
        state.grindTakenList = plan.lockedNodeIds;
        state.activateAncado = activateAncado;
        plan.appliedSignature = configurationSignature(state);
        state.optimizerPlan = plan;
      });
    },
    undo() {
      const user = useUserStore();
      if (!user.optimizerUndo) return;
      const backup = plain(user.optimizerUndo);
      user.$patch((state) => {
        for (const [key, value] of Object.entries(backup)) state[key] = value;
        state.optimizerUndo = null;
      });
    },
  },
});
