import { normalizeReservations, townReservations } from "./core.mjs";
import {
  employeeCounts,
  fingerprint,
  storageRequirements,
  STORAGE_LIMIT,
} from "./requirements.mjs";

export const copy = (value) => JSON.parse(JSON.stringify(value));
export function activeEmpireDrafts(drafts) {
  return Object.fromEntries(
    Object.entries(drafts).filter(
      ([, entry]) => fingerprint(entry.settings) !== fingerprint(entry.original)
    )
  );
}
export function empireTownSettings(game, user, townKey) {
  return {
    houseReservations: copy(
      townReservations(game.houseInfo, user.houseReservations || {}, townKey)
    ),
    workshopStorage: copy(user.workshopStorage?.[townKey] ?? null),
    storagePersonal: user.storagePersonal?.[townKey] ?? null,
  };
}
export function empireTownSignature(game, user, townKey) {
  return fingerprint([
    empireTownSettings(game, user, townKey),
    user.userWorkers
      .filter(
        (w) =>
          Number(game.tnk2tk(w.tnk)) === Number(townKey) ||
          Number(game.houseInfo[w.job?.hk]?.affTown) === Number(townKey)
      )
      .map((w) => [w.tnk, w.job]),
    user.baseStorage,
    user.lodgingP2W?.[townKey],
    user.storageP2W?.[townKey],
  ]);
}
export function draftUser(game, user, drafts) {
  const houseReservations = { ...user.houseReservations },
    workshopStorage = { ...user.workshopStorage },
    storagePersonal = { ...user.storagePersonal };
  for (const [tk, draft] of Object.entries(drafts)) {
    for (const hk of Object.keys(houseReservations))
      if (Number(game.houseInfo[hk]?.affTown) === Number(tk))
        delete houseReservations[hk];
    Object.assign(houseReservations, draft.settings.houseReservations);
    if (draft.settings.workshopStorage === null) delete workshopStorage[tk];
    else workshopStorage[tk] = draft.settings.workshopStorage;
    if (draft.settings.storagePersonal === null) delete storagePersonal[tk];
    else storagePersonal[tk] = draft.settings.storagePersonal;
  }
  return {
    houseReservations,
    workshopStorage,
    storagePersonal,
    userWorkers: user.userWorkers,
  };
}
export function defaultTrial(game, user, townKey) {
  const warehouses = storageRequirements(game, user);
  return {
    workers: employeeCounts(game, user.userWorkers)[townKey] || 0,
    storage: Number.isFinite(warehouses[townKey]?.total)
      ? warehouses[townKey].total
      : 0,
    freeBeds: 1,
    paidBeds: Number(user.lodgingP2W?.[townKey] || 0),
    freeStorage: Number(user.baseStorage || 0),
    paidStorage: Number(user.storageP2W?.[townKey] || 0),
    reservations: {},
  };
}
export function trialDemand(inputs) {
  const integer = (value, max) => {
    if (value === null || value === "" || value === undefined)
      throw new Error("Housing demand is invalid");
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > max)
      throw new Error("Housing demand is invalid");
    return n;
  };
  const workers = integer(inputs.workers, 1000),
    storage = integer(inputs.storage, STORAGE_LIMIT),
    baseLodging =
      integer(inputs.freeBeds, 1000) + integer(inputs.paidBeds, 1000),
    baseStorage = Math.min(
      STORAGE_LIMIT,
      integer(inputs.freeStorage, STORAGE_LIMIT) +
        integer(inputs.paidStorage, STORAGE_LIMIT)
    );
  return {
    workerCount: workers,
    storageCount: storage,
    baseLodging,
    baseStorage,
    wantLodging: Math.max(0, workers - baseLodging),
    wantStorage: Math.max(0, storage - baseStorage),
  };
}
export function trialUser(game, inputs) {
  // A private snapshot has no actual workers; copied workshop uses stay editable.
  const reservations = normalizeReservations(game.houseInfo, {
    houseReservations: inputs.reservations,
    userWorkers: [],
  });
  const demand = trialDemand(inputs);
  return {
    housingReservations: reservations,
    baseStorage: demand.baseStorage,
    storageP2W: {},
  };
}
