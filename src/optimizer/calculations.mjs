// Shared with the user store so forecasts and optimizer candidates use one clock.
export function resourceChance(resource, modifier) {
  if (modifier === 0) return 100;
  const times = resource.times || { 0: 0 };
  if (Object.hasOwn(times, modifier)) return times[modifier];
  const sorted = Object.keys(times)
    .map(Number)
    .sort((a, b) => a - b);
  if (modifier < sorted[0]) return 100;
  if (modifier > sorted.at(-1)) return 0;
  const upper = sorted.findIndex((value) => value > modifier);
  if (upper < 1) return 0;
  const a = sorted[upper - 1],
    b = sorted[upper];
  return times[a] + ((modifier - a) / (b - a)) * (times[b] - times[a]);
}

export function resourceTiers(workload, speed, resource) {
  const tiers = [];
  let previous = 0;
  for (
    let tier = Math.ceil(workload / speed);
    tier <= Math.ceil((2 * workload) / speed);
    tier++
  ) {
    const modifier = Math.max(2 - (speed * tier) / workload, 0);
    const time = resourceChance(resource, modifier * 100);
    if (time === 0) continue;
    tiers.push({
      wld: Math.floor((workload * (2 - modifier)) / 100) * 100,
      mod: modifier,
      tier,
      time: time - previous,
    });
    previous = time;
  }
  return tiers;
}

export function cyclesDaily(
  workload,
  speed,
  distance,
  moveSpeed,
  resource = {}
) {
  if (
    ![workload, speed, distance, moveSpeed].every(Number.isFinite) ||
    workload <= 0 ||
    speed <= 0 ||
    moveSpeed <= 0
  )
    return NaN;
  const travel = (2 * distance) / moveSpeed / 60;
  if (resource.floating) {
    return resourceTiers(workload, speed, resource).reduce(
      (sum, entry) =>
        sum +
        (1440 * entry.time) /
          100 /
          (10 * Math.ceil(entry.wld / speed) + travel),
      0
    );
  }
  return (
    1440 /
    (10 * Math.ceil((workload * (2 - (resource.productivity || 0))) / speed) +
      travel)
  );
}

export function plantzoneProfit(drop, prices, stats, distance, resource) {
  const price = (bunch) =>
    Object.entries(bunch || {}).reduce(
      (sum, [key, quantity]) =>
        quantity === 0 ? sum : sum + Number(prices[key]) * quantity,
      0
    );
  const ordinary = price(stats.isGiant ? drop.unlucky_gi : drop.unlucky);
  const cycleValue = ordinary + (price(drop.lucky) * stats.luck) / 100;
  return (
    cyclesDaily(drop.workload, stats.wspd, distance, stats.mspd, resource) *
    cycleValue
  );
}

export function skillStats(worker, skills, skillData, workerStatic) {
  const bonus = { wspd: 0, mspd: 0, luck: 0 };
  for (const key of skills) {
    const skill = skillData[key] || {};
    bonus.wspd += (skill.wspd || 0) + (skill.wspd_farm || 0);
    bonus.mspd += skill.mspd || 0;
    bonus.luck += skill.luck || 0;
  }
  return {
    ...worker,
    wspd: worker.wspd + bonus.wspd,
    mspd:
      worker.mspd +
      ((workerStatic[worker.charkey].mspd / 100) * bonus.mspd) / 100,
    luck: worker.luck + bonus.luck,
  };
}

// Port of bdo-empire v0.8.2's nine-skill candidate search (Unlicense).
// This search supplies candidates; it does not prove a global skill optimum.
export function optimizeSkills(worker, evaluate, skillData, workerStatic) {
  const work = Object.entries(skillData)
    .filter(([, s]) => s.wspd || s.wspd_farm)
    .map(([key, s]) => ({
      key: Number(key),
      amount: (s.wspd || 0) + (s.wspd_farm || 0),
      move: s.mspd || 0,
    }))
    .sort((a, b) => b.amount - a.amount || b.move - a.move || a.key - b.key);
  const score = (skills) => ({
    skills,
    value: evaluate(skillStats(worker, skills, skillData, workerStatic)),
  });
  const workSets = [score([])];
  for (let count = 1; count <= 9; count++) {
    let best = score(work.slice(0, count).map((s) => s.key));
    if (best.skills.length && !best.skills.some((key) => skillData[key].mspd)) {
      const moving = work.find((s) => s.move > 0);
      if (moving && !best.skills.includes(moving.key)) {
        const other = score([...best.skills.slice(0, -1), moving.key]);
        if (other.value > best.value) best = other;
      }
    }
    workSets.push(best);
  }
  let best = workSets[9];
  const moveLuck = Object.keys(skillData)
    .map(Number)
    .filter((key) => skillData[key].mspd || skillData[key].luck);
  const learned = [];
  for (let step = 1; step <= 9; step++) {
    const base = workSets[9 - step].skills;
    const choices = moveLuck
      .filter((key) => !base.includes(key) && !learned.includes(key))
      .map((key) => score([...base, ...learned, key]))
      .sort((a, b) => b.value - a.value);
    if (!choices.length) break;
    const candidate = choices[0];
    learned.push(candidate.skills.at(-1));
    if (candidate.value > best.value) best = candidate;
  }
  return { ...best, worker: { ...worker, skills: best.skills } };
}
