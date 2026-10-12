import { trimGraph } from "./graph.mjs";

import { SparseModel } from "./sparse.mjs";
import { addHousingVariables, housingTerms } from "../housing/core.mjs";

// Joint node selection, assignments, housing and rooted flows, following
// bdo-empire v0.8.2 (Unlicense). Storage is additionally modelled at one warehouse.
export function buildModel(snapshot, prepared) {
  const bases = new Set(
    Object.values(snapshot.nodes)
      .filter((n) => n.kind > 0 && n.kind < 3 && n.CP === 0)
      .map((n) => n.key)
  );
  const locked = [...new Set(snapshot.lockedNodeIds.map(Number))];
  if (
    (snapshot.activateAncado || snapshot.storageTown === 1343) &&
    !locked.includes(1343)
  )
    locked.push(1343);
  for (const key of locked)
    if (!snapshot.nodes[key] || !snapshot.links[key])
      throw new Error(`保留节点 ${key} 不存在有效连接`);
  const terminals = new Set([
    ...prepared.plantzoneIds,
    ...snapshot.townIds,
    ...bases,
    ...locked,
    1343,
  ]);
  const graph = trimGraph(snapshot.nodes, snapshot.links, terminals);
  const builder = new SparseModel(),
    nodeVars = new Map();
  for (const node of Object.values(graph.nodes))
    nodeVars.set(
      node.key,
      builder.variable(0, 1, true, locked.includes(node.key) ? 1 : 0)
    );
  const budget = [...nodeVars].map(([key, index]) => [
    index,
    graph.nodes[key].CP,
  ]);
  const assignments = prepared.candidates.map((candidate) => ({
    ...candidate,
    index: builder.variable(candidate.value / 1e6),
  }));
  const byPlantzone = new Map(),
    byTown = new Map();
  for (const a of assignments) {
    if (!byPlantzone.has(a.pzk)) byPlantzone.set(a.pzk, []);
    if (!byTown.has(a.town)) byTown.set(a.town, []);
    byPlantzone.get(a.pzk).push(a);
    byTown.get(a.town).push(a);
    builder.row(
      [
        [a.index, 1],
        [nodeVars.get(a.town), -1],
      ],
      -Infinity,
      0
    );
  }
  for (const [key, choices] of byPlantzone) {
    const terms = choices.map((a) => [a.index, 1]);
    builder.row(terms, -Infinity, 1);
    builder.row([...terms, [nodeVars.get(key), -1]], -Infinity, 0);
  }
  const items = new Map(
    prepared.itemKeys.map((key) => [key, builder.variable()])
  );
  for (const choices of byPlantzone.values()) {
    for (const item of choices[0].itemKeys)
      builder.row(
        [...choices.map((a) => [a.index, 1]), [items.get(item), -1]],
        -Infinity,
        0
      );
  }
  const anyProduction = builder.variable();
  builder.row(
    [
      ...assignments.map((a) => [a.index, 1]),
      [anyProduction, -Math.max(1, prepared.plantzoneIds.length)],
    ],
    -Infinity,
    0
  );
  builder.row(
    [[anyProduction, 1], ...assignments.map((a) => [a.index, -1])],
    -Infinity,
    0
  );
  const housingVars = [],
    housingModels = [];
  for (const town of prepared.infrastructure) {
    if (town.dynamicHousing) {
      const housing = addHousingVariables(
        builder,
        snapshot.houses,
        town.townKey,
        snapshot.houseReservations
      );
      housingModels.push({ ...housing, town });
      builder.row(
        [
          ...(byTown.get(town.town) || []).map((a) => [a.index, 1]),
          ...housingTerms(housing, "lodging").map(([i, v]) => [i, -v]),
        ],
        -Infinity,
        town.freeLodging
      );
      builder.row(
        [
          ...(town.warehouse
            ? [...items.values()]
                .map((i) => [i, 1])
                .concat([[anyProduction, 1]])
            : []),
          ...housingTerms(housing, "storage").map(([i, v]) => [i, -v]),
        ],
        -Infinity,
        town.freeStorage
      );
      budget.push(...housingTerms(housing, "cost"));
      continue;
    }
    const choices = town.choices.map((choice) => ({
      ...choice,
      town: town.town,
      townKey: town.townKey,
      index: builder.variable(),
    }));
    housingVars.push(...choices);
    builder.row(
      choices.map((choice) => [choice.index, 1]),
      1,
      1
    );
    builder.row(
      [
        ...(byTown.get(town.town) || []).map((a) => [a.index, 1]),
        ...choices.map((c) => [c.index, -c.lodging]),
      ],
      -Infinity,
      0
    );
    if (town.warehouse)
      builder.row(
        [...items.values()]
          .map((index) => [index, 1])
          .concat(
            [[anyProduction, 1]],
            choices.map((c) => [c.index, -c.storage])
          ),
        -Infinity,
        0
      );
    budget.push(...choices.map((c) => [c.index, c.cost]));
  }
  const fixedCost = prepared.fixedInfrastructure.reduce(
    (sum, entry) => sum + entry.cost,
    0
  );
  builder.row(budget, -Infinity, snapshot.budget - fixedCost);

  const roots = [...byTown.keys()];
  // Ancado is not a free root. Any use must also connect it to a free town.
  const superDemand = locked.length > 0 || roots.includes(1343);
  if (superDemand) roots.push(99999);
  const flowVars = new Map();
  for (const root of roots) {
    const arcs = new Map();
    flowVars.set(root, arcs);
    const demand = byTown.get(root) || [],
      capacity = root === 99999 ? locked.length + 1 : demand.length;
    const incoming = new Map(),
      outgoing = new Map();
    const arc = (source, target) => {
      const flow = builder.variable(0, capacity, false);
      arcs.set(`${source}:${target}`, flow);
      if (!outgoing.has(source)) outgoing.set(source, []);
      if (!incoming.has(target)) incoming.set(target, []);
      outgoing.get(source).push([flow, 1]);
      incoming.get(target).push([flow, -1]);
      builder.row(
        [
          [flow, 1],
          [nodeVars.get(source), -capacity],
        ],
        -Infinity,
        0
      );
      if (target !== 99999)
        builder.row(
          [
            [flow, 1],
            [nodeVars.get(target), -capacity],
          ],
          -Infinity,
          0
        );
    };
    for (const [source, targets] of Object.entries(graph.links)) {
      if (Number(source) === root) continue;
      for (const target of targets) arc(Number(source), target);
    }
    if (root === 99999)
      for (const base of bases) if (nodeVars.has(base)) arc(base, 99999);
    for (const key of [
      ...nodeVars.keys(),
      ...(root === 99999 ? [99999] : []),
    ]) {
      const terms = [
        ...(outgoing.get(key) || []),
        ...(incoming.get(key) || []),
      ];
      let constant = 0;
      if (root === 99999) {
        if (key === 99999) {
          constant = -locked.length;
          if (!locked.includes(1343) && roots.includes(1343))
            terms.push([nodeVars.get(1343), 1]);
        } else if (locked.includes(key)) constant = 1;
        else if (key === 1343 && roots.includes(1343))
          terms.push([nodeVars.get(1343), -1]);
      } else {
        if (key === root) terms.push(...demand.map((a) => [a.index, 1]));
        else
          terms.push(
            ...demand.filter((a) => a.pzk === key).map((a) => [a.index, -1])
          );
      }
      if (terms.length || constant) builder.row(terms, constant, constant);
    }
  }
  return {
    data: builder.finish(),
    nodeVars,
    assignments,
    housingVars,
    housingModels,
    itemVars: items,
    productionVar: anyProduction,
    flowVars,
    graph,
    bases,
    locked,
    prepared,
    snapshot,
  };
}
