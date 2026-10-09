export function buildDistanceIndex(distances) {
  return Object.fromEntries(Object.entries(distances).map(([plantzone, towns]) => {
    const index = new Map()
    for (const [town, distance] of towns) {
      // Match the original first-match lookup if a dataset contains duplicates.
      if (!index.has(Number(town))) index.set(Number(town), distance)
    }
    return [plantzone, index]
  }))
}

export function medianWorkerStats(stat, charkey, isGiant) {
  let wspd = stat.wspd
  let mspdBonus = 0
  let luck = stat.luck
  // Preserve the existing rounding and accumulation order.
  for (let level = 2; level <= 40; level++) {
    wspd += (stat.wspd_lo + stat.wspd_hi) / 2
    mspdBonus += (stat.mspd_lo + stat.mspd_hi) / 2
    luck += (stat.luck_lo + stat.luck_hi) / 2
  }
  return {
    level: 40,
    wspd: Math.round(wspd / 1e6 * 100) / 100,
    mspd: Math.round(stat.mspd * (1 + mspdBonus / 1e6)) / 100,
    luck: Math.round(luck / 1e4 * 100) / 100,
    charkey,
    isGiant,
  }
}
