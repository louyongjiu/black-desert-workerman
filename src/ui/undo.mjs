export const copy = (value) => JSON.parse(JSON.stringify(value));

export function snapshotFields(state, fields) {
  return Object.fromEntries(fields.map((key) => [key, copy(state[key])]));
}

export function canRestore(record, state) {
  return Boolean(
    record &&
      Object.entries(record.after).every(
        ([key, value]) => JSON.stringify(state[key]) === JSON.stringify(value)
      )
  );
}

export function restorePatch(record, state) {
  if (!canRestore(record, state))
    throw new Error("Undo is unavailable because these settings changed.");
  return copy(record.before);
}
