export function persistStore(
  store,
  key,
  storage,
  interval = 200,
  select = (state) => state
) {
  let timer;
  let pending = false;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    storage.setItem(key, JSON.stringify(select(store.$state)));
    pending = false;
  };
  const unsubscribe = store.$subscribe(
    () => {
      pending = true;
      if (timer === undefined) timer = setTimeout(flush, interval);
    },
    { detached: true }
  );
  return {
    flush,
    stop() {
      unsubscribe();
      flush();
    },
  };
}
