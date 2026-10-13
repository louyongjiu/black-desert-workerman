import { prepareValues } from "./values.mjs";
import { buildModel } from "./model.mjs";
import { decodeResult } from "./result.mjs";
import { greedySeed } from "./seed.mjs";

export function solveSnapshot(highs, snapshot, emit = () => {}) {
  const started = performance.now();
  emit({ type: "progress", stage: "values" });
  const prepared = prepareValues(snapshot, (update) =>
    emit({ type: "progress", ...update })
  );
  emit({
    type: "progress",
    stage: "model",
    candidates: prepared.consideredPlantzones,
  });
  const problem = buildModel(snapshot, prepared);
  let baselineCP = null;
  if (snapshot.schemaVersion === 2) {
    emit({ type: "progress", stage: "baseline" });
    const basePrepared = {
      ...prepared,
      candidates: [],
      plantzoneIds: [],
      itemKeys: [],
    };
    const baseProblem = buildModel(
      { ...snapshot, budget: Infinity },
      basePrepared
    );
    const data = {
      ...baseProblem.data,
      colCost: new Float64Array(baseProblem.data.numCols),
      sense: 1,
    };
    for (const [i, cost] of baseProblem.budgetTerms) data.colCost[i] += cost;
    const baseModel = highs.createModel(data);
    try {
      baseModel.options.set({
        output_flag: false,
        time_limit: Math.max(0.1, Math.min(5, snapshot.timeLimit / 4)),
        mip_rel_gap: 0,
      });
      baseModel.run();
      if (baseModel.getModelStatus() === highs.constants.modelStatus.optimal) {
        baselineCP = decodeResult(
          baseProblem,
          baseModel.getSolution().colValue
        ).totalCP;
        if (baselineCP > snapshot.budget)
          throw new Error(
            `Retained requirements need ${baselineCP} CP; the budget is ${snapshot.budget} CP`
          );
      } else if (
        baseModel.getModelStatus() === highs.constants.modelStatus.infeasible
      )
        throw new Error(
          "Retained workers and storage cannot fit the available housing"
        );
    } finally {
      baseModel.dispose();
    }
  }
  if (!prepared.candidates.length)
    throw new Error("没有可优化的采集点，请检查城镇、预算和物品价格");
  const model = highs.createModel(problem.data);
  let best = null,
    lastProgress = 0;
  const progress = (data) => ({
    type: "progress",
    stage: "solve",
    elapsed: (performance.now() - started) / 1000,
    gap: Number.isFinite(data.mip_gap) ? data.mip_gap : null,
    boundSilverPerDay: Number.isFinite(data.mip_dual_bound)
      ? data.mip_dual_bound * 1e6
      : null,
    modelSize: {
      variables: problem.data.numCols,
      constraints: problem.data.numRows,
    },
  });
  try {
    const seed = greedySeed(problem);
    if (seed) {
      best = {
        ...decodeResult(problem, seed),
        fixedBaselineCP: baselineCP,
        status: "feasible",
        gap: null,
        elapsed: (performance.now() - started) / 1000,
      };
      emit({ type: "solution", result: best });
      model.setSolution({ colValue: seed });
    }
    const remaining = snapshot.timeLimit - (performance.now() - started) / 1000;
    if (remaining <= 0 && best)
      return {
        ...best,
        status: "time_limit",
        solverVersion: highs.version.string,
      };
    if (remaining <= 0)
      throw new Error("候选计算已达到时间上限，请减少城镇或采集点数量");
    model.options.set({
      output_flag: false,
      time_limit: remaining,
      mip_rel_gap: 0.01,
      random_seed: 123456789,
    });
    emit({ type: "progress", stage: "solve", ...progress({}) });
    model.run({
      [highs.constants.callbackType.mipLogging](event) {
        if (performance.now() - lastProgress > 250) {
          emit(progress(event.data));
          lastProgress = performance.now();
        }
      },
      [highs.constants.callbackType.mipImprovingSolution](event) {
        // HiGHS returns a detached incumbent vector. Validate before exposing it.
        const result = {
          ...decodeResult(problem, event.data.mip_solution),
          fixedBaselineCP: baselineCP,
        };
        if (!best || result.profitSilverPerDay >= best.profitSilverPerDay) {
          best = { ...result, ...progress(event.data), status: "feasible" };
          emit({ type: "solution", result: best });
        }
      },
    });
    const status = model.getModelStatus();
    if (
      status === highs.constants.modelStatus.optimal ||
      model.info.get("primal_solution_status") === 2
    ) {
      const final = {
        ...decodeResult(problem, model.getSolution().colValue),
        fixedBaselineCP: baselineCP,
      };
      if (!best || final.profitSilverPerDay >= best.profitSilverPerDay)
        best = final;
    }
    if (!best)
      throw new Error(
        status === highs.constants.modelStatus.infeasible
          ? "预算或固定节点约束下没有可行方案"
          : "时间上限内未找到可行方案，请增加时间或减少候选"
      );
    return {
      ...best,
      status:
        status === highs.constants.modelStatus.optimal
          ? "optimal"
          : "time_limit",
      gap: Number.isFinite(model.info.get("mip_gap"))
        ? model.info.get("mip_gap")
        : null,
      boundSilverPerDay: Number.isFinite(model.info.get("mip_dual_bound"))
        ? model.info.get("mip_dual_bound") * 1e6
        : null,
      elapsed: (performance.now() - started) / 1000,
      solverVersion: highs.version.string,
    };
  } finally {
    model.dispose();
  }
}
