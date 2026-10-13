import { fingerprint } from "../housing/requirements.mjs";
import { supportedEmpire } from "./fixedWorkshops.mjs";
import { configurationSignature } from "./snapshot.mjs";

export function mergeEmpire(user, result, allowEmpty = false) {
  if (!supportedEmpire(user))
    throw new Error(
      "This empire contains unsupported active tasks; export a preview instead"
    );
  const alreadyApplied =
    result.appliedSignature === configurationSignature(user);
  if (!result.workers.length && !allowEmpty && !alreadyApplied)
    throw new Error(
      "Confirm removal of all gathering workers before applying a retention-only plan"
    );
  if ((result.schemaVersion || 1) < 2)
    return { workers: result.workers, bindings: [] };
  const retained = result.retainedWorkers || [],
    currentIndices = new Map(
      alreadyApplied
        ? (result.fixedWorkerBindings || []).map((b) => [
            b.originalIndex,
            b.index,
          ])
        : []
    ),
    byIndex = new Map(
      retained.map((r) => [
        alreadyApplied ? currentIndices.get(r.index) : r.index,
        r,
      ])
    ),
    workers = [],
    bindings = [];
  let next = 0;
  for (let i = 0; i < user.userWorkers.length; i++) {
    const w = user.userWorkers[i],
      fixed = byIndex.get(i);
    if (fixed) {
      if (fingerprint(w) !== fixed.fingerprint)
        throw new Error("Retained workers changed; optimize again");
      const index = workers.length;
      workers.push(w);
      bindings.push({
        originalIndex: fixed.index,
        index,
        fingerprint: fixed.fingerprint,
      });
    } else if (!w.job || w.job.kind === "workshop")
      throw new Error("Retained workers changed; optimize again");
    else if (next < result.workers.length)
      workers.push(JSON.parse(JSON.stringify(result.workers[next++])));
  }
  while (next < result.workers.length)
    workers.push(JSON.parse(JSON.stringify(result.workers[next++])));
  if (bindings.length !== retained.length)
    throw new Error("Retained workers changed; optimize again");
  return { workers, bindings };
}
export function restoredWorkers(plan, user) {
  const bindings = plan.fixedWorkerBindings || [];
  return Object.fromEntries(
    bindings.map((b) => {
      const w = user.userWorkers[b.index];
      if (!w || fingerprint(w) !== b.fingerprint)
        throw new Error("Retained workers changed; optimize again");
      return [b.originalIndex, w];
    })
  );
}
