const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);
function safeTree(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (unsafeKeys.has(key)) throw new Error("Invalid configuration file.");
    safeTree(child);
  }
}
function number(value, min = 0, max = Infinity) {
  return (
    (typeof value === "number" ||
      (typeof value === "string" && value.trim() !== "")) &&
    Number.isFinite(Number(value)) &&
    Number(value) >= min &&
    Number(value) <= max
  );
}
function numericMap(value, max = Infinity, nullable = false) {
  return (
    object(value) &&
    Object.values(value).every(
      (v) => (nullable && (v === null || v === "")) || number(v, 0, max)
    )
  );
}

// Validate before any store is changed. Unrelated fields in a full backup are ignored
// when it is opened in a prices or resources dialog.
export function parseImport(text, kind, current) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  if (!object(data)) throw new Error("Invalid configuration file.");
  safeTree(data);
  if (kind === "resources") {
    if ("regionModifiers" in data) data.regionResources = data.regionModifiers;
    if ("regionModifiers2" in data)
      data.regionResources2 = data.regionModifiers2;
  }
  if (
    kind === "prices" &&
    "farmingWorkerSilverPerDay" in data &&
    !("farmingProfit" in data)
  ) {
    if (!number(data.farmingWorkerSilverPerDay))
      throw new Error("Invalid configuration file.");
    data.farmingProfit =
      Number(current.farmingBareProfit || 0) +
      (Number(data.farmingWorkerSilverPerDay) / 1e6) * 10;
  }
  const allowed =
    kind === "prices"
      ? ["customPrices", "keepItems", "farmingProfit", "farmingBareProfit"]
      : kind === "resources"
      ? [
          "regionResources",
          "regionResources2",
          "allowFloating",
          "useFloatingResources",
        ]
      : Object.keys(current).filter(
          (key) => !["optimizerUndo", "housingUndo"].includes(key)
        );
  const patch = Object.fromEntries(
    allowed
      .filter((key) => Object.hasOwn(data, key))
      .map((key) => [key, data[key]])
  );
  if (
    !Object.keys(patch).length ||
    (kind === "empire" && !Array.isArray(patch.userWorkers))
  )
    throw new Error("This file does not contain the expected configuration.");
  for (const [key, value] of Object.entries(patch)) {
    const original = current[key];
    if (key === "mapHideInactive" && [true, false, 0, 1].includes(value))
      continue;
    if (original === null) {
      if (value !== null && !object(value))
        throw new Error("Invalid configuration file.");
    } else if (Array.isArray(original)) {
      if (!Array.isArray(value)) throw new Error("Invalid configuration file.");
    } else if (object(original)) {
      if (!object(value)) throw new Error("Invalid configuration file.");
    } else if (typeof original === "boolean") {
      if (typeof value !== "boolean")
        throw new Error("Invalid configuration file.");
    } else if (typeof original === "number") {
      if (!number(value, -Infinity))
        throw new Error("Invalid configuration file.");
      patch[key] = Number(value);
    } else if (
      typeof original === "string" &&
      typeof value !== "string" &&
      typeof value !== "number"
    ) {
      throw new Error("Invalid configuration file.");
    }
  }
  for (const key of [
    "customPrices",
    "regionResources",
    "lodgingP2W",
    "storageP2W",
    "storagePersonal",
    "lodgingTaken",
    "tradeInfraCp",
    "tradeRouteCp",
  ]) {
    if (
      key in patch &&
      !numericMap(
        patch[key],
        key === "regionResources" ? 100 : Infinity,
        key === "customPrices"
      )
    )
      throw new Error("Invalid configuration file.");
  }
  for (const key of [
    "keepItems",
    "useFloatingResources",
    "houseTaken",
    "tradeRouteAlwaysOn",
  ]) {
    if (
      key in patch &&
      (!object(patch[key]) ||
        !Object.values(patch[key]).every((v) => typeof v === "boolean"))
    )
      throw new Error("Invalid configuration file.");
  }
  if (patch.customPrices)
    patch.customPrices = Object.fromEntries(
      Object.entries(patch.customPrices).map(([key, value]) => [
        key,
        value == null || value === "" ? "" : Number(value),
      ])
    );
  if (
    "regionResources2" in patch &&
    !Object.values(patch.regionResources2).every(
      (values) =>
        Array.isArray(values) &&
        values.length &&
        values.every((v) => number(v, 0, 100))
    )
  )
    throw new Error("Invalid configuration file.");
  if ("selectedTax" in patch && !number(patch.selectedTax, 0, 1))
    throw new Error("Invalid configuration file.");
  if ("userWorkers" in patch || "defaultWorker" in patch) {
    for (const worker of [
      ...(patch.userWorkers || []),
      ...(patch.defaultWorker ? [patch.defaultWorker] : []),
    ]) {
      if (
        !object(worker) ||
        !number(worker.charkey, 1) ||
        !number(worker.tnk) ||
        !number(worker.level, 1, 40) ||
        typeof worker.label !== "string" ||
        !Array.isArray(worker.skills) ||
        !worker.skills.every((v) => typeof v === "string" || number(v))
      )
        throw new Error("Invalid worker data in configuration file.");
      for (const [sheet, legacy] of [
        ["wspdSheet", "wspdLvlup"],
        ["mspdSheet", "mspdLvlup"],
        ["luckSheet", "luckLvlup"],
      ]) {
        if (!number(worker[sheet] ?? worker[legacy]))
          throw new Error("Invalid worker data in configuration file.");
      }
      for (const key of [
        "charkey",
        "tnk",
        "level",
        "wspdSheet",
        "mspdSheet",
        "luckSheet",
        "wspdLvlup",
        "mspdLvlup",
        "luckLvlup",
      ]) {
        if (key in worker) worker[key] = Number(worker[key]);
      }
      if (
        Array.isArray(worker.job) &&
        (worker.job.length < 4 ||
          !number(worker.job[1], -Infinity) ||
          !number(worker.job[2]) ||
          typeof worker.job[3] !== "string")
      )
        throw new Error("Invalid worker data in configuration file.");
      if (
        worker.job != null &&
        worker.job !== "farming" &&
        typeof worker.job !== "number" &&
        !Array.isArray(worker.job)
      ) {
        if (
          !object(worker.job) ||
          !["plantzone", "workshop", "custom", "farming", "palace"].includes(
            worker.job.kind
          )
        )
          throw new Error("Invalid worker data in configuration file.");
        if (worker.job.kind === "plantzone" && !number(worker.job.pzk, 1))
          throw new Error("Invalid worker data in configuration file.");
        if (worker.job.kind === "workshop" && !number(worker.job.hk, 1))
          throw new Error("Invalid worker data in configuration file.");
        if (
          worker.job.kind === "custom" &&
          (!number(worker.job.profit, -Infinity) ||
            !number(worker.job.cp) ||
            typeof worker.job.label !== "string")
        )
          throw new Error("Invalid worker data in configuration file.");
        for (const key of ["pzk", "storage", "hk", "profit", "cp"])
          if (key in worker.job && number(worker.job[key], -Infinity))
            worker.job[key] = Number(worker.job[key]);
      }
    }
  }
  if (
    "userWorkshops" in patch &&
    !Object.values(patch.userWorkshops).every(
      (workshop) => object(workshop) && typeof workshop.industry === "string"
    )
  )
    throw new Error("Invalid configuration file.");
  return patch;
}

export function importSummary(patch) {
  return Object.entries(patch).map(([key, value]) => ({
    key,
    value: value == null || typeof value === "object" ? null : value,
    count: Array.isArray(value)
      ? value.length
      : object(value)
      ? Object.keys(value).length
      : null,
  }));
}
