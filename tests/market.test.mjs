import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function marketHarness(
  fetch,
  user = { selectedLang: "tw", selectedRegion: "NA" }
) {
  const source = readFileSync(
    new URL("../src/stores/market.js", import.meta.url),
    "utf8"
  )
    .replace(/^import .*\r?\n/gm, "")
    .replace("export const useMarketStore =", "const useMarketStore =");
  const saved = [];
  const options = vm.runInNewContext(source + "\nuseMarketStore", {
    defineStore: (options) => options,
    useUserStore: () => user,
    useGameStore: () => ({
      itemKeys: [4202, 5401],
      vendorPrices: {},
      ready: true,
      craftInputItemKeySet: new Set(),
    }),
    fetchJson: async () => ({}),
    fetch,
    localStorage: {
      setItem: (key, value) => saved.push({ key, value: JSON.parse(value) }),
    },
    console: { log() {}, warn() {} },
    URLSearchParams,
    setTimeout: (callback) => callback(),
  });
  const market = options.state();
  user.keepItems ||= {};
  Object.defineProperty(market, "$state", { get: () => market });
  for (const [name, fn] of Object.entries(options.actions))
    market[name] = fn.bind(market);
  return { market, saved };
}

const entries = [
  { itemId: 4202, price: 16000 },
  { itemId: 5401, price: 1000 },
  { itemId: 9492, price: 6500 },
];

test("market requests stay on the app origin and preserve language and region", async () => {
  for (const selectedLang of ["tw", "jp"]) {
    const urls = [];
    const { market, saved } = marketHarness(
      async (url) => {
        urls.push(url);
        return { ok: true, json: async () => ({ result: { data: entries } }) };
      },
      { selectedLang, selectedRegion: "NA" }
    );
    await market.fetchData();
    assert.equal(urls.length, 1);
    const url = new URL(
      urls[0],
      "https://black-desert-workerman.vercel.app/workerman/settings"
    );
    assert.equal(url.origin, "https://black-desert-workerman.vercel.app");
    assert.equal(url.pathname, "/api/bdolytics/market");
    assert.deepEqual(JSON.parse(url.searchParams.get("input")), {
      language: selectedLang === "jp" ? "ja" : "tw",
      region: "NA",
    });
    assert.equal(market.ready, true);
    assert.equal(market.apiAlive, true);
    assert.equal(market.apiFetching, false);
    assert.equal(saved[0].key, "market");
    assert.equal(saved[0].value.apiPrices[4202], 16000);
    assert.equal(saved[0].value.apiFetching, false);
  }
});

test("out-of-order region responses cannot replace the latest prices or cache", async () => {
  const pending = [];
  const user = { selectedLang: "tw", selectedRegion: "NA" };
  const { market, saved } = marketHarness(
    () => new Promise((resolve) => pending.push(resolve)),
    user
  );
  const first = market.fetchData();
  user.selectedRegion = "EU";
  const second = market.fetchData();
  pending[1]({
    ok: true,
    json: async () => ({
      result: { data: entries.map((e) => ({ ...e, price: e.price + 1 })) },
    }),
  });
  await second;
  assert.equal(market.apiRegion, "EU");
  assert.equal(market.apiPrices[4202], 16001);
  pending[0]({ ok: true, json: async () => ({ result: { data: entries } }) });
  await first;
  assert.equal(market.apiPrices[4202], 16001);
  assert.equal(market.apiRegion, "EU");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].value.apiRegion, "EU");
});

test("an older completed request does not stop the new region loading indicator", async () => {
  const pending = [];
  const user = { selectedLang: "tw", selectedRegion: "NA" };
  const { market } = marketHarness(
    () => new Promise((resolve) => pending.push(resolve)),
    user
  );
  market.apiRegion = "NA";
  market.apiPrices = { 4202: 999 };
  const first = market.fetchData();
  user.selectedRegion = "EU";
  const second = market.fetchData();
  assert.equal(Object.keys(market.apiPrices).length, 0);
  pending[0]({ ok: true, json: async () => ({ result: { data: entries } }) });
  await first;
  assert.equal(market.apiFetching, true);
  pending[1]({ ok: true, json: async () => ({ result: { data: entries } }) });
  await second;
  assert.equal(market.apiFetching, false);
  assert.equal(market.apiRegion, "EU");
});

test("an obsolete Arsha fallback cannot publish into the newly selected region", async () => {
  let finishFallback, fallbackStarted;
  const started = new Promise((resolve) => {
    fallbackStarted = resolve;
  });
  const user = { selectedLang: "tw", selectedRegion: "NA" };
  const { market, saved } = marketHarness(async (url) => {
    if (url.startsWith("/api/")) {
      const { region } = JSON.parse(
        new URL(url, "https://example.test").searchParams.get("input")
      );
      return {
        ok: true,
        json: async () => ({
          result: { data: region === "NA" ? [entries[0]] : entries },
        }),
      };
    }
    fallbackStarted();
    return new Promise((resolve) => {
      finishFallback = resolve;
    });
  }, user);
  const first = market.fetchData();
  await started;
  user.selectedRegion = "EU";
  await market.fetchData();
  finishFallback({
    ok: true,
    json: async () => [
      { id: 5401, basePrice: 99999 },
      { id: 9492, basePrice: 99999 },
    ],
  });
  await first;
  assert.equal(market.apiPrices[5401], 1000);
  assert.equal(market.apiRegion, "EU");
  assert.equal(saved.length, 1);
});

test("failed primary responses use Arsha and retain console region mapping", async () => {
  for (const primary of [
    async () => ({ ok: false, status: 403 }),
    async () => {
      throw new TypeError("Failed to fetch");
    },
    async () => ({ ok: true, json: async () => ({ error: "unavailable" }) }),
  ]) {
    const urls = [];
    const { market } = marketHarness(
      async (url) => {
        urls.push(url);
        if (url.startsWith("/api/")) return primary();
        const request = new URL(url);
        assert.equal(request.origin, "https://api.arsha.io");
        assert.equal(request.pathname, "/v2/console_na/item");
        assert.equal(request.searchParams.get("lang"), "tw");
        return {
          ok: true,
          json: async () =>
            request.searchParams
              .getAll("id")
              .map((id) => ({ id: Number(id), basePrice: 1234 })),
        };
      },
      { selectedLang: "tw", selectedRegion: "CNA" }
    );
    await market.fetchData();
    assert.equal(urls.length, 2);
    assert.equal(market.apiPrices[4202], 1234);
    assert.equal(market.apiPrices[5401], 1234);
    assert.equal(market.apiPrices[9492], 1234);
    assert.equal(market.ready, true);
    assert.equal(market.apiAlive, true);
    assert.equal(market.apiPartial, false);
    assert.equal(market.apiFetching, false);
  }
});

test("an incomplete fallback reports missing prices instead of claiming success", async () => {
  const { market, saved } = marketHarness(async (url) => {
    if (url.startsWith("/api/")) return { ok: false, status: 403 };
    return { ok: true, json: async () => ({ id: 4202, basePrice: 16000 }) };
  });
  await market.fetchData();
  assert.equal(market.ready, true);
  assert.equal(market.apiAlive, false);
  assert.equal(market.apiPartial, true);
  assert.equal(market.apiMissingCount, 2);
  assert.equal(market.apiFetching, false);
  assert.equal(saved[0].value.apiPartial, true);
});
