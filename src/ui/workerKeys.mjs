const identities = new WeakMap();
let nextIdentity = 0;

// UI identity survives edits and moves without adding IDs to exported workers.
export function workerKey(worker) {
  if (!identities.has(worker)) identities.set(worker, ++nextIdentity);
  return identities.get(worker);
}
