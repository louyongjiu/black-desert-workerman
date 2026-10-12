import { SparseModel } from "../optimizer/sparse.mjs";
import { assertFeasibleColumns } from "../optimizer/result.mjs";
import { addHousingVariables, housingTerms, decodeHousing } from "./core.mjs";

export function solveHousing(highs, request, emit = () => {}) {
  const wantLodging = Math.max(0, Math.ceil(request.wantLodging)),
    wantStorage = Math.max(0, Math.ceil(request.wantStorage));
  if (
    !Number.isFinite(wantLodging) ||
    !Number.isFinite(wantStorage) ||
    wantLodging > 1000 ||
    wantStorage > 2000
  )
    throw new Error("Housing demand is invalid");
  const builder = new SparseModel();
  const housing = addHousingVariables(
    builder,
    request.houses,
    request.townKey,
    request.reservations,
    true
  );
  builder.row(housingTerms(housing, "lodging"), wantLodging, Infinity);
  builder.row(housingTerms(housing, "storage"), wantStorage, Infinity);
  const data = builder.finish();
  data.sense = 1;
  const model = highs.createModel(data);
  let best = null;
  const decode = (columns) => {
    assertFeasibleColumns(data, columns);
    return {
      ...decodeHousing(
        housing,
        columns,
        request.wantLodging,
        request.wantStorage
      ),
      sourceKey: request.key,
      townKey: Number(request.townKey),
    };
  };
  try {
    model.options.set({
      output_flag: false,
      time_limit: request.timeLimit || 10,
      mip_rel_gap: 0,
    });
    model.run({
      [highs.constants.callbackType.mipImprovingSolution](event) {
        const result = decode(event.data.mip_solution);
        if (!best || result.cost < best.cost) {
          best = result;
          emit(result);
        }
      },
    });
    const status = model.getModelStatus();
    if (model.info.get("primal_solution_status") === 2)
      best = decode(model.getSolution().colValue);
    if (!best)
      return {
        success: false,
        pending: false,
        cost: NaN,
        lodging: NaN,
        storage: NaN,
        indices: [],
        states: [],
        wantLodging: request.wantLodging,
        wantStorage: request.wantStorage,
        sourceKey: request.key,
        error:
          status === highs.constants.modelStatus.infeasible
            ? "No housing plan satisfies these reservations"
            : "No housing plan found within the time limit",
      };
    return {
      ...best,
      status:
        status === highs.constants.modelStatus.optimal
          ? "optimal"
          : "time_limit",
      gap: Number.isFinite(model.info.get("mip_gap"))
        ? model.info.get("mip_gap")
        : null,
    };
  } finally {
    model.dispose();
  }
}
