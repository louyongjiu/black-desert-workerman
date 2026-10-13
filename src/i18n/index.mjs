import core from './core.mjs';
import research from './research.mjs';
import optimizer from './optimizer.mjs';
import about from './about.mjs';
import housing from './housing.mjs';
import empireHousing from './empireHousing.mjs';
import housingWorkbench from './housingWorkbench.mjs';
import { common as extra, optimizer as optimizerExtra } from './extra.mjs';

export const languages = Object.freeze({
  en: { name: 'English', locale: 'en-US', html: 'en' },
  tw: { name: '繁體中文', locale: 'zh-TW', html: 'zh-Hant' },
  ru: { name: 'Русский', locale: 'ru-RU', html: 'ru' },
  ko: { name: '한국어', locale: 'ko-KR', html: 'ko' },
  jp: { name: '日本語', locale: 'ja-JP', html: 'ja' },
});
export const localeIds = Object.keys(languages);
export const normalize = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
export const messages = Object.create(null);

function addTable(table, sourceIsEnglish = true) {
  for (const line of table.trim().split('\n')) {
    const [source, ...values] = line.trim().split('¦');
    const translations = sourceIsEnglish ? [source, ...values] : values;
    if (translations.length !== 5 || translations.some((value) => !value)) {
      throw new Error(`Incomplete UI translation: ${source}`);
    }
    messages[normalize(source)] = Object.fromEntries(
      ['en', 'tw', 'ru', 'ko', 'jp'].map((id, index) => [
        id,
        translations[index],
      ])
    );
  }
}
addTable(core);
addTable(housing);
addTable(empireHousing);
addTable(housingWorkbench);
addTable(research);
addTable(optimizer, false);
addTable(extra);
addTable(optimizerExtra, false);
for (const [source, values] of Object.entries(about)) {
  messages[normalize(source)] = Object.fromEntries(
    ['en', 'tw', 'ru', 'ko', 'jp'].map((id, index) => [
      id,
      index === 0 ? source : values[index - 1],
    ])
  );
}

const patterns = Object.entries(messages)
  .filter(([source]) => /\{\w+\}/.test(source))
  .map(([source, translations]) => {
    const names = [];
    const escaped = source
      .split(/(\{\w+\})/)
      .map((part) => {
        if (/^\{\w+\}$/.test(part)) {
          names.push(part.slice(1, -1));
          return '(.+?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return { translations, names, regex: new RegExp(`^${escaped}$`) };
  });

export function translate(source, language = 'en', params = {}) {
  if (source == null) return '';
  const key = normalize(source);
  const id = Object.prototype.hasOwnProperty.call(languages, language) ? language : 'en';
  let entry = messages[key],
    values = params;
  if (!entry) {
    for (const pattern of patterns) {
      const match = key.match(pattern.regex);
      if (match) {
        entry = pattern.translations;
        values = {
          ...Object.fromEntries(
            pattern.names.map((name, i) => [name, match[i + 1]])
          ),
          ...params,
        };
        break;
      }
    }
  }
  const result = (entry?.[id] ?? key).replace(/\{(\w+)\}/g, (token, name) =>
    name in values
      ? name === 'error'
        ? translate(values[name], id)
        : String(values[name])
      : token
  );
  return (
    String(source).match(/^\s*/)[0] + result + String(source).match(/\s*$/)[0]
  );
}

export function createTranslator(getLanguage) {
  return (source, params) => translate(source, getLanguage(), params);
}
