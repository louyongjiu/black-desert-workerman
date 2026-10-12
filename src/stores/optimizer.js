import { defineStore } from "pinia";
import { useGameStore } from "./game";
import { useUserStore } from "./user";
import { useMarketStore } from "./market";
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
  }),
  actions: {
    start(options) {
      if (this.running) return;
      try {
        const snapshot = createSnapshot(
          useGameStore(),
          useUserStore(),
          useMarketStore(),
          options
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
    apply() {
      const user = useUserStore();
      if (this.running || !this.result)
        throw new Error("请等待优化完成或先停止计算");
      if (!this.result.workers.length)
        throw new Error("方案未分配采集工人，请增加预算或扩大候选范围");
      if (this.result.sourceSignature !== configurationSignature(user))
        throw new Error("工人或基础设施设置已变化，请重新优化");
      if (
        this.result.valueSignature !==
        valuationSignature(user, useMarketStore())
      )
        throw new Error("价格或资源设置已变化，请重新优化");
      if (!canReplaceGatheringWorkers(user))
        throw new Error(
          "首版应用支持仅有采集或空闲工人的帝国；其他任务可先保留并导出本方案"
        );
      const plan = plain(this.result);
      user.optimizerUndo = plain({
        userWorkers: user.userWorkers,
        grindTakenList: user.grindTakenList,
        activateAncado: user.activateAncado,
        optimizerPlan: user.optimizerPlan,
      });
      user.userWorkers = plan.workers;
      user.grindTakenList = plan.lockedNodeIds;
      user.activateAncado =
        plan.assignments.some((a) => a.town === 1343) ||
        plan.storageTown === 1343 ||
        user.activateAncado;
      plan.appliedSignature = configurationSignature(user);
      user.optimizerPlan = plan;
    },
    undo() {
      const user = useUserStore();
      if (!user.optimizerUndo) return;
      const backup = plain(user.optimizerUndo);
      user.$patch(backup);
      user.optimizerUndo = null;
    },
  },
});
