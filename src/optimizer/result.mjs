import { shortestPath } from "./graph.mjs";

export function assertFeasibleColumns(data, columns, tolerance = 1e-5) {
  if (columns.length !== data.numCols)
    throw new Error("求解结果的变量数量不匹配");
  for (let index = 0; index < columns.length; index++) {
    const value = columns[index];
    if (
      !Number.isFinite(value) ||
      value < data.colLower[index] - tolerance ||
      value > data.colUpper[index] + tolerance ||
      (data.integrality[index] &&
        Math.abs(value - Math.round(value)) > tolerance)
    )
      throw new Error("求解结果未满足变量约束");
  }
  const matrix = data.matrix;
  for (let row = 0; row < data.numRows; row++) {
    let value = 0;
    for (
      let entry = matrix.starts[row];
      entry < matrix.starts[row + 1];
      entry++
    )
      value += matrix.values[entry] * columns[matrix.indices[entry]];
    if (
      value < data.rowLower[row] - tolerance ||
      value > data.rowUpper[row] + tolerance
    )
      throw new Error(`求解结果未满足约束 ${row}`);
  }
}

export function decodeResult(problem, columns) {
  assertFeasibleColumns(problem.data, columns);
  const { snapshot, prepared, graph, bases } = problem;
  const selected = new Set(
    [...problem.nodeVars]
      .filter(([, index]) => columns[index] > 0.5)
      .map(([id]) => id)
  );
  const used = new Set(),
    assignments = [],
    grindRoutes = [];
  const trace = (source, target) => {
    const path = shortestPath(
      graph.nodes,
      graph.links,
      source,
      target,
      selected
    );
    if (!path) throw new Error(`节点 ${source} 缺少有效的连接路径`);
    path.forEach((id) => used.add(id));
    return path;
  };
  for (const id of problem.locked)
    grindRoutes.push({
      node: id,
      path: trace(id, bases),
      infrastructure: !snapshot.lockedNodeIds.includes(id),
    });
  for (const candidate of problem.assignments) {
    if (columns[candidate.index] < 0.5) continue;
    const assignment = { ...candidate };
    delete assignment.index;
    assignments.push({
      ...assignment,
      path: trace(candidate.pzk, candidate.town),
    });
  }
  if (
    assignments.some((a) => a.town === 1343) &&
    !problem.locked.includes(1343)
  )
    grindRoutes.push({
      node: 1343,
      path: trace(1343, bases),
      infrastructure: true,
    });
  const itemKeys = [...new Set(assignments.flatMap((a) => a.itemKeys))];
  const housing = prepared.infrastructure
    .map((town) => {
      const workerCount = assignments.filter(
        (a) => a.town === town.town
      ).length;
      const storageCount = town.warehouse
        ? itemKeys.length + (assignments.length ? 1 : 0)
        : 0;
      const choice = town.choices.find(
        (c) => c.lodging >= workerCount && c.storage >= storageCount
      );
      if (!choice) throw new Error(`城镇 ${town.town} 的容量不足`);
      return {
        town: town.town,
        townKey: town.townKey,
        workerCount,
        storageCount,
        ...choice,
      };
    })
    .concat(
      prepared.fixedInfrastructure.map((town) => ({
        ...town,
        workerCount: 0,
        storageCount: 0,
      }))
    );
  const nodeCP = [...used].reduce((sum, id) => sum + graph.nodes[id].CP, 0);
  const infrastructureCP = housing.reduce((sum, town) => sum + town.cost, 0);
  if (nodeCP + infrastructureCP > snapshot.budget + 1e-5)
    throw new Error("复核后的贡献点成本超过预算");
  const workers = assignments.map((a) => ({
    tnk: a.town,
    charkey: a.worker.charkey,
    label: `优化 ${a.pzk}`,
    level: 40,
    wspdSheet: a.worker.wspd,
    mspdSheet: a.worker.mspd,
    luckSheet: a.worker.luck,
    skills: a.worker.skills,
    job: { kind: "plantzone", pzk: a.pzk, storage: snapshot.storageTown },
  }));
  return {
    schemaVersion: 1,
    createdAt: snapshot.createdAt,
    sourceSignature: snapshot.sourceSignature,
    valueSignature: snapshot.valueSignature,
    assignments,
    selectedNodeIds: [...used].sort((a, b) => a - b),
    grindRoutes,
    housing,
    workers,
    lockedNodeIds: snapshot.lockedNodeIds,
    storageTown: snapshot.storageTown,
    nodeCP,
    infrastructureCP,
    totalCP: nodeCP + infrastructureCP,
    profitSilverPerDay: assignments.reduce((sum, a) => sum + a.value, 0),
    budget: snapshot.budget,
    consideredPlantzones: prepared.consideredPlantzones,
    eligiblePlantzones: prepared.eligiblePlantzones,
    missingPrices: prepared.missing,
    priceUpdatedAt: snapshot.priceUpdatedAt,
    modelSize: {
      variables: problem.data.numCols,
      constraints: problem.data.numRows,
    },
    assumptions: [
      "40 级平均属性工人，按采集点搜索九项技能候选",
      "候选范围内优化；不包含围栏、工作坊、自定义和贸易任务收益",
    ],
  };
}
