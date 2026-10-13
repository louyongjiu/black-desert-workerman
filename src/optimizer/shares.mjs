export function connectionShares(routing, nodes) {
  const jobs = routing.pzWsJobs.map,
    users = new Map(),
    result = new Map(jobs.map((j) => [j, { value: 0, parts: [] }]));
  for (const job of jobs)
    for (const id of new Set(job.usedPath || [])) {
      if (routing.autotakenGrindNodes.has(id)) continue;
      if (!users.has(id)) users.set(id, []);
      users.get(id).push(job);
    }
  for (const [id, list] of users) {
    const weights = list.map((j) =>
      Number.isFinite(j.profit.priceDaily)
        ? Math.max(0, j.profit.priceDaily)
        : 0
    );
    const sum = weights.reduce((n, v) => n + v, 0);
    for (let i = 0; i < list.length; i++) {
      const value = nodes[id].CP * (sum ? weights[i] / sum : 1 / list.length),
        share = result.get(list[i]);
      share.value += value;
      share.parts.push({ id, value });
    }
  }
  return result;
}
