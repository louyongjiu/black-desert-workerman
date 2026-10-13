import {
  fingerprint,
  employeeCounts,
  storageRequirements,
} from "../housing/requirements.mjs";
import { shortestPath } from "./graph.mjs";

export function supportedEmpire(user) {
  if (user.farmingEnable || user.palaceEnable) return false;
  if (
    (user.userWorkers || []).some(
      (w) =>
        w.job &&
        typeof w.job !== "number" &&
        !["plantzone", "workshop"].includes(w.job.kind)
    )
  )
    return false;
  return !(user.userWorkers || []).some(
    (w) =>
      w.job?.kind === "workshop" &&
      user.tradeRouteAlwaysOn?.[w.tnk] &&
      Number(user.tradeDestinations?.[w.tnk]) > 0
  );
}
export function validateFixedPath(game, path, source, target) {
  if (
    !Array.isArray(path) ||
    !path.length ||
    !(
      (path[0] === source && path.at(-1) === target) ||
      (path[0] === target && path.at(-1) === source)
    ) ||
    new Set(path).size !== path.length ||
    path.some(
      (id, i) =>
        !game.nodes[id] || (i && !game.links[path[i - 1]]?.includes(id))
    )
  )
    throw new Error(`Workshop route is invalid: ${source} → ${target}`);
}
export function captureFixedWorkshops(game, user, routing) {
  const workers = [],
    routes = [],
    consumed = new Set();
  for (let index = 0; index < user.userWorkers.length; index++) {
    const worker = user.userWorkers[index];
    if (worker.job && worker.job.kind !== "workshop") continue;
    const record = {
      index,
      worker: JSON.parse(JSON.stringify(worker)),
      fingerprint: fingerprint(worker),
    };
    workers.push(record);
    if (!worker.job) continue;
    const house = game.houseInfo[worker.job.hk];
    if (!house) throw new Error(`Workshop house is invalid: ${worker.job.hk}`);
    const source = Number(worker.tnk),
      target = Number(game.tk2tnk(house.affTown));
    const jobs = routing?.pzWsJobs?.ws || [];
    const job =
      jobs.find((j, i) => !consumed.has(i) && j.worker === worker) ||
      jobs.find(
        (j, i) =>
          !consumed.has(i) && fingerprint(j.worker) === record.fingerprint
      );
    if (job) consumed.add(jobs.indexOf(job));
    const path = source === target ? [source] : job?.usedPath;
    validateFixedPath(game, path, source, target);
    let profit = null;
    try {
      const value =
        game.profitWorkshopWorker(
          worker.job.hk,
          user.getUserWorkshop(worker.job.hk),
          worker
        ).priceDaily * 1e6;
      if (Number.isFinite(value)) profit = value;
    } catch {
      /* Missing production inputs do not invent income. */
    }
    routes.push({
      workerIndex: index,
      fingerprint: record.fingerprint,
      hk: Number(worker.job.hk),
      source,
      target,
      path: [...path],
      profitSilverPerDay: profit,
    });
  }
  const retained = workers.map((r) => r.worker);
  const storage = Object.fromEntries(
    Object.entries(storageRequirements(game, user, retained, false)).filter(
      ([, t]) => t.total || t.workshops.length
    )
  );
  for (const t of Object.values(storage))
    if (!t.resolved)
      throw new Error(
        `Review workshop storage at town ${t.townKey}: ${t.issues[0]}`
      );
  const activationRoutes = [];
  if (routes.some((r) => r.source === 1343 || r.target === 1343)) {
    const bases = new Set(
      Object.values(game.nodes)
        .filter((n) => n.kind > 0 && n.kind < 3 && n.CP === 0)
        .map((n) => n.key)
    );
    const allowed = new Set([
      ...(routing?.autotakenNodes || []),
      ...bases,
      1343,
    ]);
    const path = shortestPath(game.nodes, game.links, 1343, bases, allowed);
    if (!path)
      throw new Error(
        "Retained Ancado workers need a valid activation connection"
      );
    activationRoutes.push({ node: 1343, path });
  }
  return {
    workers,
    routes,
    activationRoutes,
    counts: employeeCounts(game, retained),
    storage,
    nodes: [
      ...new Set([...routes, ...activationRoutes].flatMap((r) => r.path)),
    ],
  };
}
