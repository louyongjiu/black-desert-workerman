// Housing dependency and exclusive-use model adapted from Thell/bdo-housecraft
// 0.3.18, commit 3af0b47113c4709afab148ae2d3fa83748e08ac6 (Unlicense).
const beds = [0, 1, 2, 4, 6, 8],
  slots = [0, 3, 5, 8, 12, 16];
const signatures = new WeakMap();
export function housingDataSignature(houses) {
  if (!signatures.has(houses))
    signatures.set(
      houses,
      JSON.stringify(
        Object.values(houses).map((h) => [
          h.key,
          h.CP,
          h.needHouseKey,
          h.affTown,
          h.CraftList,
        ])
      )
    );
  return signatures.get(houses);
}
export function capacity(house, usage) {
  const level = Number(house.CraftList?.[usage] || 0);
  const value = (usage === 1 ? beds : slots)[level];
  if (!Number.isFinite(value))
    throw new Error(`Invalid housing level: ${house.key}`);
  return value;
}

export function normalizeReservations(houses, user) {
  const result = {};
  for (const [key, value] of Object.entries(user.houseReservations || {})) {
    const usage = Number(value?.usage ?? value);
    const house = houses[key];
    if (!house || !Number.isInteger(usage) || !(usage in house.CraftList))
      throw new Error(`House reservation is invalid: ${key}`);
    result[key] = { usage, automatic: false };
  }
  for (const worker of user.userWorkers || []) {
    if (worker.job?.kind !== "workshop") continue;
    const key = String(worker.job.hk),
      house = houses[key];
    const usage = Object.keys(house?.CraftList || {})
      .map(Number)
      .find((u) => u > 10);
    if (usage === undefined)
      throw new Error(`Workshop house is invalid: ${key}`);
    if (result[key] && result[key].usage <= 10)
      throw new Error(`House is reserved for another use: ${key}`);
    result[key] = { usage: result[key]?.usage ?? usage, automatic: true };
  }
  return result;
}

export function reservationSignature(reservations) {
  return JSON.stringify(
    Object.entries(reservations).sort((a, b) => Number(a[0]) - Number(b[0]))
  );
}

export function townHouses(houses, townKey) {
  const result = Object.values(houses).filter(
    (h) => Number(h.affTown) === Number(townKey)
  );
  const map = new Map(result.map((h) => [Number(h.key), h]));
  for (const house of result) {
    if (!Number.isFinite(house.CP) || house.CP < 0)
      throw new Error(`Invalid house cost: ${house.key}`);
    const seen = new Set();
    let current = house;
    while (current) {
      if (seen.has(current.key))
        throw new Error(`House dependency cycle: ${house.key}`);
      seen.add(current.key);
      if (!current.needHouseKey) break;
      current = map.get(Number(current.needHouseKey));
      if (!current)
        throw new Error(`House dependency is missing: ${house.key}`);
    }
  }
  return result;
}

export function townReservations(houses, reservations, townKey) {
  return Object.fromEntries(
    Object.entries(reservations).filter(
      ([key]) => Number(houses[key]?.affTown) === Number(townKey)
    )
  );
}

export function addHousingVariables(
  builder,
  houses,
  townKey,
  reservations,
  objective = false
) {
  const selectedHouses = townHouses(houses, townKey),
    vars = new Map();
  for (const house of selectedHouses) {
    const lock = reservations[house.key];
    const storage = capacity(house, 2),
      lodging = capacity(house, 1);
    const rent = builder.variable(
      objective ? house.CP : 0,
      1,
      true,
      lock ? 1 : 0
    );
    const s = builder.variable(
      0,
      storage && (!lock || lock.usage === 2) ? 1 : 0,
      true,
      lock?.usage === 2 ? 1 : 0
    );
    const l = builder.variable(
      0,
      lodging && (!lock || lock.usage === 1) ? 1 : 0,
      true,
      lock?.usage === 1 ? 1 : 0
    );
    const other = builder.variable(
      0,
      !lock || (lock.usage !== 1 && lock.usage !== 2) ? 1 : 0,
      true,
      lock && lock.usage !== 1 && lock.usage !== 2 ? 1 : 0
    );
    builder.row(
      [
        [s, 1],
        [l, 1],
        [other, 1],
        [rent, -1],
      ],
      0,
      0
    );
    vars.set(Number(house.key), {
      house,
      lock,
      rent,
      s,
      l,
      other,
      storage,
      lodging,
    });
  }
  for (const v of vars.values())
    if (v.house.needHouseKey)
      builder.row(
        [
          [v.rent, 1],
          [vars.get(Number(v.house.needHouseKey)).rent, -1],
        ],
        -Infinity,
        0
      );
  return {
    townKey: Number(townKey),
    vars,
    reservations: townReservations(houses, reservations, townKey),
  };
}

export function housingTerms(model, kind) {
  return [...model.vars.values()].map((v) =>
    kind === "cost"
      ? [v.rent, v.house.CP]
      : kind === "storage"
      ? [v.s, v.storage]
      : [v.l, v.lodging]
  );
}

export function validateHousing(
  houses,
  townKey,
  reservations,
  plan,
  wantLodging = 0,
  wantStorage = 0
) {
  const list = townHouses(houses, townKey),
    map = new Map(list.map((h) => [Number(h.key), h]));
  const usages = new Map();
  for (let i = 0; i < plan.indices.length; i++) {
    const key = Number(plan.indices[i]);
    if (key === Number(townKey) && plan.states[i] === 0) continue;
    const house = map.get(key),
      state = plan.states[i];
    const usage = plan.usages?.[i] ?? (state === 1 ? 2 : state === 2 ? 1 : 0);
    if (
      !house ||
      usages.has(key) ||
      ![1, 2, 3].includes(state) ||
      !(usage in house.CraftList) ||
      (state === 1 && usage !== 2) ||
      (state === 2 && usage !== 1) ||
      (state === 3 && (usage === 1 || usage === 2))
    )
      throw new Error("Housing result is invalid");
    usages.set(key, usage);
  }
  let cost = 0,
    lodging = 0,
    storage = 0,
    workshopCP = 0;
  for (const [key, usage] of usages) {
    const house = map.get(key);
    if (house.needHouseKey && !usages.has(Number(house.needHouseKey)))
      throw new Error("Housing dependencies are incomplete");
    cost += house.CP;
    if (usage === 1) lodging += capacity(house, 1);
    if (usage === 2) storage += capacity(house, 2);
    if (reservations[key]?.automatic) workshopCP += house.CP;
  }
  for (const [key, lock] of Object.entries(
    townReservations(houses, reservations, townKey)
  ))
    if (usages.get(Number(key)) !== lock.usage)
      throw new Error("Housing result conflicts with a reservation");
  if (lodging < Math.max(0, wantLodging) || storage < Math.max(0, wantStorage))
    throw new Error("Housing capacity is insufficient");
  if (
    cost !== plan.cost ||
    lodging !== plan.lodging ||
    storage !== plan.storage
  )
    throw new Error("Housing totals do not match");
  return { workshopCP, lodging, storage, cost };
}

export function decodeHousing(
  model,
  columns,
  wantLodging = 0,
  wantStorage = 0
) {
  const indices = [model.townKey],
    states = [0],
    usages = [null];
  let cost = 0,
    lodging = 0,
    storage = 0;
  for (const [key, v] of model.vars) {
    if (columns[v.rent] < 0.5) continue;
    const state = columns[v.s] > 0.5 ? 1 : columns[v.l] > 0.5 ? 2 : 3;
    const usage = state === 1 ? 2 : state === 2 ? 1 : v.lock?.usage ?? 0;
    indices.push(key);
    states.push(state);
    usages.push(usage);
    cost += v.house.CP;
    storage += state === 1 ? v.storage : 0;
    lodging += state === 2 ? v.lodging : 0;
  }
  const plan = {
    indices,
    states,
    usages,
    cost,
    lodging,
    storage,
    wantLodging,
    wantStorage,
    success: true,
    reservations: model.reservations,
  };
  const houses = Object.fromEntries(
    [...model.vars].map(([k, v]) => [k, v.house])
  );
  return {
    ...plan,
    ...validateHousing(
      houses,
      model.townKey,
      model.reservations,
      plan,
      wantLodging,
      wantStorage
    ),
  };
}

// Feasible repairs of old chains seed the solver only. They are not a complete
// frontier under reservations; the house variables search the omitted chains.
export function repairHousingChoice(
  houses,
  townKey,
  reservations,
  choice,
  lodging
) {
  const usages = new Map(
    choice.indices
      .filter((k) => Number(k) !== Number(townKey))
      .map((k) => {
        const i = choice.indices.indexOf(k);
        return [
          Number(k),
          choice.states[i] === 1 ? 2 : choice.states[i] === 2 ? 1 : 0,
        ];
      })
  );
  for (const [key, lock] of Object.entries(
    townReservations(houses, reservations, townKey)
  )) {
    usages.set(Number(key), lock.usage);
    let parent = houses[key].needHouseKey;
    while (parent) {
      if (!usages.has(parent)) usages.set(parent, 0);
      parent = houses[parent].needHouseKey;
    }
  }
  let cost = 0,
    storage = 0,
    bedsCount = 0;
  const indices = [Number(townKey)],
    states = [0],
    purposes = [null];
  for (const [key, usage] of usages) {
    const h = houses[key];
    if (!h) return null;
    indices.push(key);
    states.push(usage === 2 ? 1 : usage === 1 ? 2 : 3);
    purposes.push(usage);
    cost += h.CP;
    storage += usage === 2 ? capacity(h, 2) : 0;
    bedsCount += usage === 1 ? capacity(h, 1) : 0;
  }
  return {
    indices,
    states,
    usages: purposes,
    cost,
    storage,
    lodging: bedsCount,
    originalLodging: lodging,
  };
}
