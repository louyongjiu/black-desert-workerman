import { configurationSignature } from "./snapshot.mjs";
import { housingDataSignature } from "../housing/core.mjs";
import { planningDataSignature } from "../housing/requirements.mjs";
import { restoredWorkers } from "./application.mjs";
import { validateFixedPath } from "./fixedWorkshops.mjs";

export function appliedRouting(user, game) {
  const plan = user.optimizerPlan;
  if (
    !plan ||
    plan.appliedSignature !== (user.planningConfigurationSignature ?? configurationSignature(user)) ||
    (plan.dataSignature &&
      plan.dataSignature !== planningDataSignature(game)) ||
    (plan.housingDataSignature &&
      plan.housingDataSignature !== housingDataSignature(game.houseInfo)) ||
    !game.ready
  )
    return null;
  const ret = {
    autotakenNodes: new Set(),
    autotakenNodesCP: 0,
    autotakenWorkerNodes: new Set(),
    autotakenWorkerNodesCP: 0,
    autotakenGrindNodes: new Set(),
    autotakenGrindNodesCP: 0,
    autotakenWagonNodes: new Set(),
    autotakenWagonNodesCP: 0,
    linkColors: {},
    pzWsJobs: { pz: {}, ws: [], map: [], nodeUsedbyJob: {} },
  };
  const addPath = (path, type) => {
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      if (!game.nodes[key] || (i && !game.links[path[i - 1]]?.includes(key)))
        throw new Error("Saved route no longer exists");
      if (!ret.autotakenNodes.has(key)) {
        ret.autotakenNodes.add(key);
        ret.autotakenNodesCP += game.nodes[key].CP;
        const kind = type === "grind" ? "Grind" : "Worker";
        ret[`autotaken${kind}Nodes`].add(key);
        ret[`autotaken${kind}NodesCP`] += game.nodes[key].CP;
      }
      if (i) {
        const a = path[i - 1];
        ret.linkColors[`${Math.min(a, key)}-${Math.max(a, key)}`] ||= type;
      }
    }
  };
  try {
    const retained = restoredWorkers(plan, user);
    for (const route of plan.fixedActivationRoutes || [])
      addPath(route.path, "worker");
    for (const route of plan.fixedWorkshopRoutes || []) {
      const worker = retained[route.workerIndex];
      if (!worker || Number(worker.job?.hk) !== route.hk) return null;
      validateFixedPath(game, route.path, route.source, route.target);
      addPath(route.path, "worker");
      const config = user.getUserWorkshop(route.hk);
      const profit = game.profitWorkshopWorker(route.hk, config, worker);
      const job = {
        hk: route.hk,
        worker,
        profit,
        usedPath: route.path,
        usedPathCost: route.path.reduce(
          (sum, id) => sum + game.nodes[id].CP,
          0
        ),
        thriftyPercent: 0,
      };
      if (game.craftInputs && worker.job.recipe in game.craftInputs)
        for (const sk of worker.skills || [])
          for (const key of ["thriftyA", "thriftyB", "thriftyC"])
            job.thriftyPercent += game.skillData[sk]?.[key] || 0;
      ret.pzWsJobs.ws.push(job);
      ret.pzWsJobs.map.push(job);
    }
    for (const entry of plan.grindRoutes)
      addPath(entry.path, entry.infrastructure ? "worker" : "grind");
    for (const entry of plan.assignments) {
      const worker = user.userWorkers.find(
        (w) => w.tnk === entry.town && w.job?.pzk === entry.pzk
      );
      if (
        !worker ||
        entry.path[0] !== entry.pzk ||
        entry.path.at(-1) !== entry.town
      )
        return null;
      addPath(entry.path, "worker");
      const stats = game.workerStatsOnPlantzone(worker);
      const profit = game.profitPzTownStats(
        entry.pzk,
        entry.town,
        stats.wspd,
        stats.mspd,
        stats.luck,
        game.isGiant(worker.charkey)
      );
      const job = {
        pzk: entry.pzk,
        worker,
        profit,
        usedPath: entry.path,
        usedPathCost: entry.path.reduce(
          (sum, key) => sum + game.nodes[key].CP,
          0
        ),
      };
      ret.pzWsJobs.pz[entry.pzk] = job;
      ret.pzWsJobs.map.push(job);
    }
    return ret;
  } catch {
    return null;
  }
}
