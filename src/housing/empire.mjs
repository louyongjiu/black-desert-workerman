import { configurationSignature } from "../optimizer/snapshot.mjs";
import { planningDataSignature } from "./requirements.mjs";
import { housingDataSignature, capacity } from "./core.mjs";
export function validAppliedPlan(user, game) {
  const plan = user.optimizerPlan;
  return Boolean(
    plan &&
      plan.appliedSignature === configurationSignature(user) &&
      (!plan.housingDataSignature ||
        plan.housingDataSignature === housingDataSignature(game.houseInfo)) &&
      (!plan.dataSignature ||
        plan.dataSignature === planningDataSignature(game))
  );
}
export function validPreview(plan, user, game) {
  return Boolean(
    plan &&
      plan.sourceSignature === configurationSignature(user) &&
      (!plan.housingDataSignature ||
        plan.housingDataSignature === housingDataSignature(game.houseInfo)) &&
      (!plan.dataSignature ||
        plan.dataSignature === planningDataSignature(game))
  );
}
export function housingFromPlan(plan, townKey, game, user) {
  const h = plan?.housing?.find((t) => Number(t.townKey) === Number(townKey));
  if (!h) return null;
  // Early gathering plans stored effective capacity, including free capacity.
  const rawCapacity = (usage, fallback) =>
    game
      ? (h.indices || []).reduce(
          (n, hk, i) =>
            n +
            (game.houseInfo[hk] && h.states[i] === (usage === 1 ? 2 : 1)
              ? capacity(game.houseInfo[hk], usage)
              : 0),
          0
        )
      : fallback;
  const baseLodging =
    h.baseLodging ?? 1 + Number(user?.lodgingP2W?.[townKey] || 0);
  const baseStorage =
    h.baseStorage ??
    Number(user?.baseStorage || 0) + Number(user?.storageP2W?.[townKey] || 0);
  const totalStorage =
    h.storageCount +
    (plan.schemaVersion === 1
      ? Number(user?.storagePersonal?.[townKey] || 0)
      : 0);
  return {
    ...h,
    housingMethod: h.housingMethod || (h.dynamicHousing ? "solve" : "lookup"),
    lodging: h.houseLodging ?? rawCapacity(1, h.lodging),
    storage: h.houseStorage ?? rawCapacity(2, h.storage),
    wantLodging: h.wantLodging ?? h.workerCount - baseLodging,
    wantStorage: h.wantStorage ?? totalStorage - baseStorage,
    baseLodging,
    baseStorage,
    storageCount: totalStorage,
    success: true,
  };
}
