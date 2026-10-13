// Shared inventory accounting; no prices or production-volume guesses are used.
export const STORAGE_LIMIT = 192;
export function stable(value) {
  if (Array.isArray(value)) return value.map((v) => stable(v) ?? null);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((k) => value[k] !== undefined)
        .map((k) => [k, stable(value[k])])
    );
  return value;
}
export const fingerprint = (value) => JSON.stringify(stable(value));
export const plantzoneItemKeys = (drop) => [
  ...new Set(
    ["unlucky", "unlucky_gi", "lucky"].flatMap((k) =>
      Object.entries(drop?.[k] || {})
        .filter(([, q]) => q > 0)
        .map(([id]) => id)
    )
  ),
];
function integer(value, max = STORAGE_LIMIT) {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 0 || n > max)
    throw new Error(
      "Storage reservation must be a nonnegative whole number within the warehouse limit"
    );
  return n;
}
export function employeeCounts(game, workers) {
  const result = {};
  for (const w of workers) {
    const tk = game.tnk2tk(w.tnk);
    if (tk === undefined) throw new Error(`Worker town is invalid: ${w.tnk}`);
    result[tk] = (result[tk] || 0) + 1;
  }
  return result;
}
export function workshopReviewSignature(game, user, townKey, workshops) {
  const config = user.workshopStorage?.[townKey] || {};
  return fingerprint([
    workshops.map((w) => [
      w.hk,
      w.recipe,
      game.craftInputs?.[w.recipe],
      game.craftOutputs?.[w.recipe],
    ]),
    Number(user.storagePersonal?.[townKey] || 0),
    config.coverage || "automatic",
    config.manualItems || [],
    config.itemSlots || {},
    Number(config.extraSlots || 0),
    Number(config.personalIncludes || 0),
  ]);
}
export function storageRequirements(
  game,
  user,
  workers = user.userWorkers || [],
  includeGathering = true
) {
  const towns = {};
  const town = (tk) =>
    (towns[tk] ||= {
      townKey: Number(tk),
      items: {},
      workshops: [],
      issues: [],
      extra: 0,
      personal: 0,
      spare: 0,
      slots: 0,
      total: 0,
    });
  for (const tk of Object.keys(user.storagePersonal || {})) town(tk);
  const add = (t, id) => {
    const key = String(id);
    if (!/^\d+$/.test(key))
      throw new Error("Storage item IDs must be whole numbers");
    t.items[key] = 1;
  };
  for (const w of workers) {
    if (w.job?.kind === "workshop") {
      const t = town(game.tnk2tk(w.tnk));
      t.workshops.push({ hk: Number(w.job.hk), recipe: w.job.recipe });
      t.spare = 1;
    } else if (
      includeGathering &&
      (w.job?.kind === "plantzone" || typeof w.job === "number")
    ) {
      const pzk = typeof w.job === "number" ? w.job : w.job.pzk;
      const tk = game.tnk2tk(typeof w.job === "number" ? w.tnk : w.job.storage);
      if (tk === undefined)
        throw new Error("Gathering storage town is invalid");
      const t = town(tk),
        drop = game.plantzoneDrops?.[pzk];
      for (const id of plantzoneItemKeys(drop)) add(t, id);
      t.spare = 1;
    }
  }
  for (const [key, t] of Object.entries(towns)) {
    t.identified = [];
    t.nonStack = [];
    try {
      const config = user.workshopStorage?.[key] || {};
      if (
        config.manualItems !== undefined &&
        !Array.isArray(config.manualItems)
      )
        throw new Error("Workshop storage settings are invalid");
      const originalPersonal = integer(user.storagePersonal?.[key]);
      const confirmed =
        config.confirmed === true &&
        (!config.confirmedFor ||
          config.confirmedFor ===
            workshopReviewSignature(game, user, key, t.workshops));
      t.personal = originalPersonal;
      t.identified = [];
      t.nonStack = [];
      if (t.workshops.length) {
        const recognized = new Set(),
          missing = [];
        for (const w of t.workshops) {
          const inputs = game.craftInputs?.[w.recipe],
            outputs = game.craftOutputs?.[w.recipe];
          if (!inputs || !outputs) missing.push(w.hk);
          for (const id of Object.keys(inputs || {}))
            recognized.add(String(id));
          for (const id of outputs || []) recognized.add(String(id));
        }
        t.identified = [...recognized];
        t.missing = [...new Set(missing)];
        const personalMode = config.coverage === "personal";
        if (personalMode) {
          if (!confirmed || originalPersonal === 0)
            t.issues.push(
              "Confirm the personal storage reservation that covers this workshop"
            );
        } else {
          for (const id of recognized) add(t, id);
          for (const id of config.manualItems || []) add(t, id);
          const moved = integer(config.personalIncludes);
          if (moved > originalPersonal)
            t.issues.push(
              "Workshop storage transferred from personal storage exceeds the original reservation"
            );
          t.personal = Math.max(0, originalPersonal - moved);
          t.extra = integer(config.extraSlots);
          for (const id of recognized) {
            if (game.itemInfo?.[id]?.isStack !== true) {
              t.nonStack.push(id);
              const count = integer(config.itemSlots?.[id]);
              if (!count) t.issues.push(`Reserve storage slots for item ${id}`);
              else t.items[id] = count;
            }
          }
          for (const id of config.manualItems || []) {
            if (game.itemInfo?.[id]?.isStack !== true) {
              if (!t.nonStack.includes(String(id))) t.nonStack.push(String(id));
              const count = integer(config.itemSlots?.[id]);
              if (!count) t.issues.push(`Reserve storage slots for item ${id}`);
              else t.items[id] = count;
            }
          }
          if ((missing.length || originalPersonal > 0) && !confirmed)
            t.issues.push(
              "Review incomplete recipe data and the existing personal storage reservation"
            );
        }
      }
      t.slots = Object.values(t.items).reduce((n, v) => n + v, 0) + t.extra;
      t.total = t.slots + t.personal + t.spare;
      if (t.total > STORAGE_LIMIT)
        t.issues.push("Storage demand exceeds the warehouse capacity limit");
    } catch (error) {
      t.issues.push(error.message);
      t.total = NaN;
    }
    t.issues = [...new Set(t.issues)];
    t.resolved = !t.issues.length;
  }
  return towns;
}
export function addedStorage(town, items, producing) {
  const ids = [...new Set(items.map(String))].filter(
    (id) => !(id in (town.fixedItems || {}))
  );
  return ids.length + (producing && !town.fixedSpare ? 1 : 0);
}

const dataMemo = new WeakMap();
export function planningDataSignature(game) {
  const refs = [
    game.houseInfo,
    game.nodes,
    game.links,
    game.regionInfo,
    game.craftInputs,
    game.craftOutputs,
    game.itemInfo,
    game.tk2hk,
    game.workerStatic,
    game.skillData,
    game.tk2pzk,
    game.plantzoneDrops,
    game.plantzoneStatic,
  ];
  const memo = dataMemo.get(game);
  if (memo && refs.every((r, i) => r === memo.refs[i])) return memo.value;
  const text = JSON.stringify(refs),
    length = text.length;
  let a = 2166136261,
    b = 3335557771;
  for (let i = 0; i < length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 2246822519);
  }
  const value =
    (a >>> 0).toString(16).padStart(8, "0") +
    (b >>> 0).toString(16).padStart(8, "0") +
    ":" +
    length;
  dataMemo.set(game, { refs, value });
  return value;
}
