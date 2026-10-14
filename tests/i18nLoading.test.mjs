import assert from 'node:assert/strict';
import test from 'node:test';
import { computed, reactive } from 'vue';
import { compileUiCatalogs, messages as catalogue } from '../src/i18n/catalog.mjs';
import { activateUiLanguage, createTranslator, loadUiMessages, translate } from '../src/i18n/index.mjs';

const dictionaries = compileUiCatalogs();
const dictionaryFor = url => {
  const [, language, group] = url.match(/\/ui\/(\w+)\/(\w+)\.json$/);
  return dictionaries[language][group];
};

test('UI files contain only one language and shared navigation is available without optimizer texts', () => {
  for (const [language, groups] of Object.entries(dictionaries)) {
    assert.equal(groups.common['帝国优化'], catalogue['帝国优化'][language]);
    assert.equal(groups.common['价格更新于 {date}'], catalogue['价格更新于 {date}'][language]);
    assert.deepEqual(Object.assign({}, ...Object.values(groups)), Object.fromEntries(Object.entries(catalogue).map(([key, values]) => [key, values[language]])));
  }
});

test('concurrent UI loads share requests and a failed request can be retried', async t => {
  let requests = 0, resolve;
  t.mock.method(globalThis, 'fetch', url => { requests++; return new Promise(done => { resolve = () => done({ ok: true, json: async () => dictionaryFor(url) }); }); });
  const a = loadUiMessages('ru', ['common']);
  const b = loadUiMessages('ru', ['common']);
  assert.equal(requests, 1); resolve(); await Promise.all([a, b]);
  assert.equal(translate('Home', 'ru'), catalogue.Home.ru);
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async url => { attempts++; if (attempts === 1) return { ok: false, status: 503 }; return { ok: true, json: async () => dictionaryFor(url) }; });
  await assert.rejects(loadUiMessages('jp', ['optimizer']), /503/);
  await loadUiMessages('jp', ['optimizer']); assert.equal(attempts, 2);
});

test('language changes keep the previous labels until all requested dictionaries are loaded', async t => {
  t.mock.method(globalThis, 'fetch', async url => ({ ok: true, json: async () => dictionaryFor(url) }));
  await activateUiLanguage('en');
  const user = reactive({ language: 'en' }), tLabel = createTranslator(() => user.language), home = computed(() => tLabel('Home'));
  assert.equal(home.value, 'Home');
  const pending = [];
  t.mock.method(globalThis, 'fetch', url => new Promise(resolve => pending.push(() => resolve({ ok: true, json: async () => dictionaryFor(url) }))));
  user.language = 'tw';
  const loading = activateUiLanguage('tw');
  assert.equal(home.value, 'Home');
  for (const resolve of pending) resolve(); await loading;
  assert.equal(home.value, catalogue.Home.tw);
});
