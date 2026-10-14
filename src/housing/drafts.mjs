const copy = (value) => JSON.parse(JSON.stringify(value));
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);

export function projectHousingDrafts(state, detach = true) {
  // Persistence stringifies synchronously; detaching first would serialize the
  // same draft twice. Restore/public callers still receive independent copies.
  const select = detach ? copy : (value) => value;
  return {
    version: 1,
    townKey: Number.isInteger(state.townKey) ? state.townKey : 5,
    empire: select(state.empire),
    trials: Object.fromEntries(
      Object.entries(state.trials).map(([tk, entry]) => [
        tk,
        {
          inputs: select(entry.inputs),
          sourceKey: null,
          runInputs: null,
          initialResult: null,
          undo: null,
        },
      ])
    ),
    savedUndo: state.savedUndo ?? null,
    recordUndo: state.recordUndo ?? {},
  };
}

export function readHousingDrafts(text) {
  if (!text) return {};
  const saved = JSON.parse(text);
  if (saved?.version !== 1 || !object(saved.empire) || !object(saved.trials))
    throw new Error("Invalid saved housing drafts");
  if (saved.savedUndo != null && !object(saved.savedUndo))
    throw new Error("Invalid saved housing drafts");
  if (saved.recordUndo != null && !object(saved.recordUndo))
    throw new Error("Invalid saved housing drafts");
  for (const [tk, entry] of Object.entries(saved.empire)) {
    if (
      !/^\d+$/.test(tk) ||
      !object(entry.settings) ||
      !object(entry.original) ||
      typeof entry.base !== "string"
    )
      throw new Error("Invalid saved housing drafts");
  }
  for (const [tk, entry] of Object.entries(saved.trials)) {
    if (!/^\d+$/.test(tk) || !object(entry.inputs))
      throw new Error("Invalid saved housing drafts");
  }
  const state = projectHousingDrafts(saved);
  delete state.version;
  return state;
}
