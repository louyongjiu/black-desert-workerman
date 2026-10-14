import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { computed, reactive } from 'vue';
import { localizeGameLanguage } from '../src/i18n/game.mjs';
import {
  createTranslator,
  languages,
  normalize,
  translate,
} from '../src/i18n/index.mjs';
import { registerUiMessages } from '../src/i18n/index.mjs';
import { messages, compileUiCatalogs } from '../src/i18n/catalog.mjs';
for (const [language, groups] of Object.entries(compileUiCatalogs()))
  for (const [group, dictionary] of Object.entries(groups))
    registerUiMessages(language, group, dictionary);

const require = createRequire(import.meta.url);
const { parse: parseSfc, compileTemplate } = require('@vue/compiler-sfc');
const { parse: parseDom } = require('@vue/compiler-dom');
const { parseExpression } = require('@babel/parser');
const src = fileURLToPath(new URL('../src/', import.meta.url));
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]
  );
}
const components = files(src).filter(
  (file) =>
    file.endsWith('.vue') && !/HelloWorld|TheWelcome|WelcomeItem/.test(file)
);
// Only formulas, server codes and proper names may remain literal UI text.
const literals = new Set([
  'np = M',
  'np',
  'n',
  'p',
  'MSE',
  'p-val',
  'np:',
  'n:',
  'n=',
  'MSE:',
  'p-val:',
  '1 - chisquare.cdf(χ², bins - 1 - dof)',
  '= M',
  'npᴸ:',
  'nᴸ:',
  'npᵁ',
  'npᴸ',
  'e',
  'c=',
  'w=',
  'log(Y)',
  '#worker-empire',
  'buymeacoffee',
  'A',
  'B',
  'C',
  'floor(1*1.684)=1',
  'Python',
  'cache2json',
  'bdo-empire',
  'NaN',
  'Thell/bdo-housecraft',
  'x:',
  'y:',
  'ms',
  'wasm',
  'NA',
  'EU',
  'RU',
  'KR',
  'JP',
  'TW',
  'SA',
  'ASIA',
  'MENA',
  'CEU',
  'CNA',
  'MFP',
]);

test('every UI message has all five languages and retains its placeholders', () => {
  assert.ok(Object.keys(messages).length > 1000);
  const placeholders = (text) =>
    Array.from(text.matchAll(/\{(\w+)\}/g), (match) => match[1]).sort();
  for (const [key, translations] of Object.entries(messages)) {
    for (const id of Object.keys(languages)) {
      assert.ok(translations[id]?.trim(), `${id}: ${key}`);
      assert.deepEqual(
        placeholders(translations[id]),
        placeholders(key),
        `${id}: ${key}`
      );
    }
  }
});

test('language changes invalidate cached interface labels immediately', () => {
  const user = reactive({ selectedLang: 'en' });
  const t = createTranslator(() => user.selectedLang);
  const home = computed(() => t('Home'));
  assert.equal(home.value, 'Home');
  for (const language of ['tw', 'ru', 'ko', 'jp', 'en']) {
    user.selectedLang = language;
    assert.equal(home.value, messages.Home[language]);
    assert.equal(t('帝国优化'), messages['帝国优化'][language]);
  }
});

test('worker errors with values and nested errors localize at rendering time', () => {
  assert.equal(
    translate('节点 123 缺少有效的连接路径', 'en'),
    'Node 123 has no valid connection path'
  );
  assert.equal(translate('城镇 601 的容量不足', 'tw'), '城鎮 601 容量不足');
  assert.equal(
    translate('价格更新失败：Missing required market prices', 'tw'),
    '價格更新失敗：缺少必要的市場價格'
  );
  assert.equal(translate('  contains:\n', 'tw'), '  內含：\n');
  assert.equal(translate('Unknown label', 'unsupported'), 'Unknown label');
  assert.equal(translate('Home', '__proto__'), 'Home');
  assert.equal(translate(null, 'tw'), '');
});

test('Korean display corrections cover housing, workers and skills without mutating data', () => {
  const original = JSON.parse(readFileSync(new URL('../data/loc/ko.json', import.meta.url)));
  const corrected = localizeGameLanguage(original, 'ko');
  for (const category of ['town', 'char', 'housetype', 'skill', 'skilldesc']) {
    assert.deepEqual(Object.keys(corrected[category]), Object.keys(original[category]));
  }
  for (const category of ['town', 'housetype', 'skill', 'skilldesc']) {
    assert.ok(Object.values(corrected[category]).every(value => !/[A-Za-z]{4}/.test(value)), category);
  }
  for (const [id, value] of Object.entries(corrected.char)) {
    if (Number(id) < 7500) assert.ok(!/[A-Za-z]{4}/.test(value), `${id}: ${value}`);
    assert.ok(!/\bWorker\b/.test(value), `${id}: ${value}`);
  }
  assert.equal(original.housetype['1'], 'Lodging');
  assert.equal(corrected.housetype['1'], '숙소');
  assert.equal(corrected.char['7572'], '장인 고블린 일꾼');
  assert.strictEqual(corrected.item, original.item);
  assert.strictEqual(corrected.recipe, original.recipe);
  const english = localizeGameLanguage(original, 'en');
  assert.strictEqual(english.housetype, original.housetype);
});

test('all routed page and dialog templates compile and contain no untranslated UI literals', () => {
  function checkExpression(expression, file) {
    let ast;
    try {
      ast = parseExpression(expression);
    } catch {
      return;
    }
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (
        node.type === 'CallExpression' &&
        node.callee.name === '$t' &&
        node.arguments[0]?.type === 'StringLiteral'
      ) {
        const key = normalize(node.arguments[0].value);
        assert.ok(messages[key], `Unknown message in ${file}: ${key}`);
      }
      for (const [key, value] of Object.entries(node))
        if (!['loc', 'comments'].includes(key)) {
          if (Array.isArray(value)) value.forEach(walk);
          else if (value && typeof value === 'object') walk(value);
        }
    }
    walk(ast);
  }
  function walk(node, file) {
    if (node.type === 2 && /[a-zA-Z\u3400-\u9fff]/.test(node.content)) {
      assert.ok(
        literals.has(normalize(node.content)),
        `Untranslated text in ${file}: ${normalize(node.content)}`
      );
    }
    if (node.type === 5) checkExpression(node.content.content, file);
    if (node.type === 1) {
      for (const prop of node.props) {
        if (
          prop.type === 6 &&
          prop.value &&
          [
            'title',
            'placeholder',
            'aria-label',
            'alt',
            'data-tooltip',
          ].includes(prop.name)
        ) {
          assert.ok(
            literals.has(normalize(prop.value.content)),
            `Untranslated attribute in ${file}: ${prop.value.content}`
          );
        }
        if (prop.type === 7 && prop.name === 'bind' && prop.exp)
          checkExpression(prop.exp.content, file);
      }
      // Translating the visible label of an option must never change its value.
      if (
        node.tag === 'option' &&
        node.children.some(
          (child) => child.type === 5 && /\$t\(/.test(child.content.content)
        )
      ) {
        assert.ok(
          node.props.some(
            (prop) => prop.name === 'value' || prop.arg?.content === 'value'
          ),
          `Missing option value in ${file}`
        );
      }
    }
    for (const child of node.children || []) walk(child, file);
  }
  for (const file of components) {
    const { descriptor } = parseSfc(readFileSync(file, 'utf8'));
    if (!descriptor.template) continue;
    const compiled = compileTemplate({
      source: descriptor.template.content,
      filename: file,
      id: file,
    });
    assert.deepEqual(compiled.errors, [], `Compile failed: ${file}`);
    walk(parseDom(descriptor.template.content), file);
  }
});
