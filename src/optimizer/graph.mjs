export function shortestPath(nodes, links, start, target, allowed) {
  const targets = target instanceof Set ? target : new Set([target]);
  if (!nodes[start] || (allowed && !allowed.has(start))) return null;
  const queue = [start],
    seen = new Set(queue),
    parent = new Map();
  for (let offset = 0; offset < queue.length; offset++) {
    const current = queue[offset];
    if (targets.has(current)) {
      const path = [current];
      while (parent.has(path.at(-1))) path.push(parent.get(path.at(-1)));
      return path.reverse();
    }
    for (const neighbor of links[current] || []) {
      if (
        !nodes[neighbor] ||
        seen.has(neighbor) ||
        (allowed && !allowed.has(neighbor))
      )
        continue;
      seen.add(neighbor);
      parent.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  return null;
}

export function connectionTree(nodes, links, target) {
  const reversed = Object.fromEntries(
    Object.keys(nodes).map((key) => [key, []])
  );
  for (const [source, neighbors] of Object.entries(links)) {
    for (const next of neighbors)
      if (reversed[next]) reversed[next].push(Number(source));
  }
  const roots = target instanceof Set ? [...target] : [target];
  const costs = {},
    nextNode = {},
    unsettled = new Set();
  for (const root of roots)
    if (nodes[root]) {
      costs[root] = nodes[root].CP;
      unsettled.add(root);
    }
  while (unsettled.size) {
    let current;
    for (const key of unsettled)
      if (current === undefined || costs[key] < costs[current]) current = key;
    unsettled.delete(current);
    for (const next of reversed[current]) {
      const cost = costs[current] + nodes[next].CP;
      if (costs[next] === undefined || cost < costs[next]) {
        costs[next] = cost;
        nextNode[next] = current;
        unsettled.add(next);
      }
    }
  }
  return { costs, nextNode, roots: new Set(roots) };
}

export function connectionCosts(nodes, links, target) {
  return connectionTree(nodes, links, target).costs;
}

export function treePath(tree, start) {
  if (tree.costs[start] === undefined) return null;
  const path = [start];
  while (!tree.roots.has(path.at(-1))) {
    const next = tree.nextNode[path.at(-1)];
    if (next === undefined || path.includes(next)) return null;
    path.push(next);
  }
  return path;
}

export function trimGraph(nodes, links, terminals) {
  const alive = new Set(
    Object.keys(links)
      .map(Number)
      .filter((key) => nodes[key])
  );
  // Only remove leaves with no demand or root: every possible connecting path survives.
  const neighbors = new Map([...alive].map((key) => [key, new Set()]));
  for (const key of alive)
    for (const next of links[key] || []) {
      if (alive.has(next)) {
        neighbors.get(key).add(next);
        neighbors.get(next).add(key);
      }
    }
  const queue = [...alive].filter(
    (key) => neighbors.get(key).size < 2 && !terminals.has(key)
  );
  for (let offset = 0; offset < queue.length; offset++) {
    const key = queue[offset];
    if (!alive.delete(key)) continue;
    for (const next of neighbors.get(key)) {
      neighbors.get(next).delete(key);
      if (neighbors.get(next).size < 2 && !terminals.has(next))
        queue.push(next);
    }
  }
  return {
    nodes: Object.fromEntries([...alive].map((key) => [key, nodes[key]])),
    links: Object.fromEntries(
      [...alive].map((key) => [
        key,
        (links[key] || []).filter((next) => alive.has(next)),
      ])
    ),
  };
}
