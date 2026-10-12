import { connectionTree, treePath } from "./graph.mjs";
import { assertFeasibleColumns } from "./result.mjs";

// Construct a complete feasible MIP start, including all continuous flows.
// This is a quick lower bound; HiGHS still performs the joint optimization.
export function greedySeed(problem) {
  const { graph, bases, snapshot, prepared } = problem;
  const baseTree = connectionTree(graph.nodes, graph.links, bases);
  const trees = new Map(
    [...new Set(problem.assignments.map((a) => a.town))].map((root) => [
      root,
      connectionTree(graph.nodes, graph.links, root),
    ])
  );
  const fixedPaths = [];
  let selected = new Set(),
    chosen = [],
    pickedPlants = new Set();
  for (const source of problem.locked) {
    const path = treePath(baseTree, source);
    if (!path) return null;
    path.forEach((key) => selected.add(key));
    fixedPaths.push(path);
  }
  const housing = (assignments) => {
    const items = new Set(assignments.flatMap((a) => a.itemKeys));
    const picked = [];
    for (const town of prepared.infrastructure) {
      const count = assignments.filter((a) => a.town === town.town).length;
      const storage = town.warehouse
        ? items.size + (assignments.length ? 1 : 0)
        : 0;
      const choice = problem.housingVars.find(
        (c) =>
          c.town === town.town && c.lodging >= count && c.storage >= storage
      );
      if (!choice) return null;
      picked.push(choice);
    }
    return picked;
  };
  const totalCP = (nodes, rooms) =>
    [...nodes].reduce((sum, id) => sum + graph.nodes[id].CP, 0) +
    rooms.reduce((sum, c) => sum + c.cost, 0) +
    prepared.fixedInfrastructure.reduce((sum, c) => sum + c.cost, 0);
  const candidates = [...problem.assignments].sort(
    (a, b) =>
      b.value / Math.max(1, trees.get(b.town).costs[b.pzk]) -
      a.value / Math.max(1, trees.get(a.town).costs[a.pzk])
  );
  for (const candidate of candidates) {
    if (pickedPlants.has(candidate.pzk)) continue;
    const path = treePath(trees.get(candidate.town), candidate.pzk);
    if (!path) continue;
    const proposed = [...chosen, { ...candidate, seedPath: path }];
    const next = new Set([...selected, ...path]);
    if (
      next.has(1343) &&
      problem.flowVars.has(99999) &&
      !problem.locked.includes(1343)
    ) {
      const connection = treePath(baseTree, 1343);
      if (!connection) continue;
      connection.forEach((id) => next.add(id));
    }
    const rooms = housing(proposed);
    if (!rooms || totalCP(next, rooms) > snapshot.budget) continue;
    chosen = proposed;
    selected = next;
    pickedPlants.add(candidate.pzk);
  }
  const rooms = housing(chosen);
  if (!rooms || totalCP(selected, rooms) > snapshot.budget) return null;
  const columns = new Float64Array(problem.data.numCols);
  for (const id of selected) columns[problem.nodeVars.get(id)] = 1;
  for (const room of rooms) columns[room.index] = 1;
  for (const item of new Set(chosen.flatMap((a) => a.itemKeys)))
    columns[problem.itemVars.get(item)] = 1;
  columns[problem.productionVar] = chosen.length ? 1 : 0;
  const flow = (root, path) => {
    const arcs = problem.flowVars.get(root);
    for (let i = 1; i < path.length; i++) {
      const index = arcs?.get(`${path[i - 1]}:${path[i]}`);
      if (index === undefined) throw new Error("Seed path lacks a model arc");
      columns[index]++;
    }
  };
  try {
    for (const assignment of chosen) {
      columns[assignment.index] = 1;
      flow(assignment.town, assignment.seedPath);
    }
    for (const path of fixedPaths) flow(99999, [...path, 99999]);
    if (
      selected.has(1343) &&
      problem.flowVars.has(99999) &&
      !problem.locked.includes(1343)
    ) {
      flow(99999, [...treePath(baseTree, 1343), 99999]);
    }
    assertFeasibleColumns(problem.data, columns);
    return columns;
  } catch {
    return null;
  }
}
