import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parse } from "@vue/compiler-sfc";
import { createRenderer, h, nextTick, reactive } from "vue";
import { formatPrice, unformatPrice } from "../src/util.js";
import { warehouseSlots } from "../src/housing/overview.mjs";
import { optimizationOptionsChanged } from "../src/optimizer/snapshot.mjs";

// Mount the real Options API scripts so immediate/reused-prop watchers run in Vue.
// Layout and actual inputs are checked separately in the local browser.
const renderer = createRenderer({
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  insert() {},
  remove() {},
  setText() {},
  setElementText() {},
  patchProp() {},
  parentNode: () => null,
  nextSibling: () => null,
});
function mount(file, initialProps, state = {}, globals = {}, bindings = {}) {
  const script = parse(readFileSync(new URL(file, import.meta.url), "utf8"))
    .descriptor.script.content;
  const options = vm.runInNewContext(
    script
      .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\r?\n/gm, "")
      .replace("export default", "const component =") + "\ncomponent",
    {
      console: { log() {} },
      clearTimeout,
      clearInterval,
      formatFixed() {},
      formatPrice,
      unformatPrice,
      warehouseSlots,
      ItemIcon: {},
      WorkerJobDescription: {},
      WorkshopStorage: {},
      HouseReservations: {},
      ImportPreview: {},
      ModalDialog: {},
      WorkerEdit: {},
      WorkshopsConfig: {},
      TradingConfig: {},
      PriceInput: {},
      languages: {},
      PlantzonesRow: {},
      localizedAsyncComponent: () => ({}),
      ...bindings,
    }
  );
  options.setup = () => state;
  let instance;
  options.render = function () {
    instance = this;
    return h("div");
  };
  const props = reactive(initialProps);
  const app = renderer.createApp({ render: () => h(options, props) });
  Object.assign(app.config.globalProperties, globals);
  app.mount({});
  return { instance, props, unmount: () => app.unmount() };
}

test("dispatch initializes the first-open warehouse and follows a reused worker", async () => {
  const { instance, props, unmount } = mount(
    "../src/components/WorkerSendSelection.vue",
    { w: { tnk: 301 }, show: true }
  );
  assert.equal(instance.selectedRedirect, 301);
  instance.selectedRedirect = 1;
  props.w = { tnk: 601 };
  await nextTick();
  assert.equal(instance.selectedRedirect, 601);
  props.defaultRedirect = 301;
  await nextTick();
  assert.equal(instance.selectedRedirect, 301);
  instance.selectedRedirect = 1;
  props.show = false;
  await nextTick();
  props.show = true;
  await nextTick();
  assert.equal(instance.selectedRedirect, 301);
  unmount();
});

test("external price changes reset editing, while typing echoes retain the raw text", async () => {
  const { instance, props, unmount } = mount(
    "../src/components/lo/PriceInputAbbrHeld.vue",
    { modelValue: 1000, resetKey: {} }
  );
  instance.onInput({ target: { value: "1.500k" } });
  props.modelValue = 1500;
  await nextTick();
  assert.equal(instance.display, "1.500k");
  props.modelValue = 2200;
  await nextTick();
  assert.equal(instance.display, formatPrice(2200));
  instance.onInput({ target: { value: "abc" } });
  assert.equal(instance.invalid, true);
  props.modelValue = undefined;
  await nextTick();
  assert.equal(instance.display, "");
  assert.equal(instance.invalid, false);
  instance.onInput({ target: { value: "abc" } });
  props.resetKey = {}; // Empty import replaces the map even if the price is still undefined.
  await nextTick();
  assert.equal(instance.display, "");
  assert.equal(instance.invalid, false);
  unmount();
});

test("housing inventory follows town changes without phantom personal slots or missing workshop slots", async () => {
  const user = reactive({
    baseStorage: 16,
    lodgingP2W: {},
    storageP2W: { 2: 16 },
    storagePersonal: { 2: 5 },
    warehouseRequirements: {
      2: { items: { 10: 3, 20: 1 }, extra: 2, personal: 4, spare: 1 },
    },
    townsInfra: {
      1: { storage: 0, wantStorage: -16 },
      2: { storage: 4, wantStorage: 3 },
    },
  });
  const { instance, props, unmount } = mount(
    "../src/components/HousesSelection.vue",
    { tk: 1 },
    { userStore: user, gameStore: { itemInfo: {} } }
  );
  assert.equal(instance.storageViewCount, 16);
  assert.equal(instance.requiredStorage, 0);
  assert.equal(instance.personalStorage, 0);
  assert.deepEqual(instance.ingameSortedItems, []);
  assert.deepEqual(Object.keys(user.storagePersonal), ["2"]);
  props.tk = 2;
  await nextTick();
  assert.equal(instance.storageViewCount, 36);
  assert.equal(instance.ingameSortedItems.length, 11);
  assert.equal(
    instance.ingameSortedItems.filter((key) => key === "10").length,
    3
  );
  props.tk = 1;
  await nextTick();
  assert.equal(instance.storageViewCount, 16);
  assert.deepEqual(instance.ingameSortedItems, []);
  instance.personalStorage = 3;
  assert.equal(user.storagePersonal[1], 3);
  assert.equal(user.storagePersonal[2], 5);
  unmount();
});

test("same-page deep links reveal filtered targets and scroll only once", async () => {
  for (const [file, hash, search, filter, reset] of [
    ["SettingsView", "#item4001", "itemSearch", "priceFilter", "all"],
    ["PlantzonesView", "#drops101", "nodeSearch", "filterTown", -1],
  ]) {
    const route = reactive({ hash: "" });
    let scrolls = 0;
    const target = {
      scrollIntoView() {
        scrolls++;
      },
      classList: { add() {} },
    };
    const { instance, unmount } = mount(
      `../src/views/${file}.vue`,
      {},
      {},
      { $route: route },
      { document: { getElementById: () => target } }
    );
    instance[search] = "hidden by search";
    instance[filter] = file === "SettingsView" ? "custom" : 301;
    route.hash = hash;
    await nextTick();
    await nextTick();
    assert.equal(instance[search], "");
    assert.equal(instance[filter], reset);
    assert.equal(scrolls, 1);
    instance[search] = "another filter";
    await nextTick();
    instance.highlightHash();
    assert.equal(scrolls, 1);
    unmount();
  }
});

test("optimizer detects changed form settings but ignores hiring town order", () => {
  const options = {
    budget: 300,
    timeLimit: 30,
    maxPlantzones: 370,
    storageTown: 601,
    includeGrind: true,
    townIds: [1, 301],
  };
  const plan = { optimizationOptions: options };
  assert.equal(
    optimizationOptionsChanged(plan, { ...options, townIds: [301, "1", 301] }),
    false
  );
  for (const patch of [
    { budget: 200 },
    { storageTown: 1 },
    { townIds: [1] },
    { maxPlantzones: 100 },
    { timeLimit: 5 },
    { includeGrind: false },
  ])
    assert.equal(
      optimizationOptionsChanged(plan, { ...options, ...patch }),
      true
    );
});

test("optimizer store rejects applying a result after its draft warehouse changes", () => {
  const source = readFileSync(
    new URL("../src/stores/optimizer.js", import.meta.url),
    "utf8"
  )
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\r?\n/gm, "")
    .replace("export const useOptimizerStore", "const useOptimizerStore")
    .replaceAll("import.meta.url", JSON.stringify(import.meta.url));
  const options = vm.runInNewContext(source + "\nuseOptimizerStore", {
    defineStore: (_name, value) => value,
    optimizationOptionsChanged,
    useUserStore: () => ({ userWorkers: [] }),
  });
  const store = options.state();
  const inputs = {
    budget: 300,
    timeLimit: 30,
    maxPlantzones: 370,
    storageTown: 601,
    includeGrind: true,
    townIds: [1],
  };
  store.result = { optimizationOptions: inputs };
  store.draftOptions = { ...inputs, storageTown: 301 };
  assert.throws(
    () => options.actions.apply.call(store, true),
    /Optimization settings changed/
  );
});
