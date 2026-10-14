import { ref } from "vue";
import { fetchJson } from "../dataLoading.mjs";
import { languages, normalize } from "./meta.mjs";
export { languages, localeIds, normalize, uiGroupsForRoute } from "./meta.mjs";

export const messages = Object.create(null);
const revision = ref(0);
const activeLanguage = ref("en");
const patterns = [];
const patternKeys = new Set();
const loaded = new Set();
const requests = new Map();
const requiredGroups = new Set(["common"]);
let activation = 0;

export function registerUiMessages(language, group, dictionary) {
  for (const [source, translation] of Object.entries(dictionary)) {
    const key = normalize(source);
    const translations = (messages[key] ||= Object.create(null));
    translations[language] = translation;
    if (/\{\w+\}/.test(key) && !patternKeys.has(key)) {
      const names = [];
      const escaped = key
        .split(/(\{\w+\})/)
        .map((part) => {
          if (/^\{\w+\}$/.test(part)) {
            names.push(part.slice(1, -1));
            return "(.+?)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("");
      patterns.push({ translations, names, regex: new RegExp(`^${escaped}$`) });
      patternKeys.add(key);
    }
  }
  loaded.add(`${language}:${group}`);
  revision.value++;
}

export function loadUiMessages(language, groups = ["common"]) {
  if (!Object.hasOwn(languages, language))
    return Promise.reject(new Error(`Unsupported UI language: ${language}`));
  for (const group of groups) requiredGroups.add(group);
  return Promise.all(
    groups.map((group) => {
      const key = `${language}:${group}`;
      if (loaded.has(key)) return Promise.resolve();
      if (!requests.has(key)) {
        const request = fetchJson(`data/ui/${language}/${group}.json`)
          .then((dictionary) => registerUiMessages(language, group, dictionary))
          .finally(() => requests.delete(key));
        requests.set(key, request);
      }
      return requests.get(key);
    })
  );
}

export async function activateUiLanguage(language) {
  const generation = ++activation;
  await loadUiMessages(language, [...requiredGroups]);
  if (generation === activation) {
    activeLanguage.value = language;
    revision.value++;
  }
}

export function translate(source, language = "en", params = {}) {
  revision.value;
  if (source == null) return "";
  const key = normalize(source);
  const id = Object.prototype.hasOwnProperty.call(languages, language)
    ? language
    : "en";
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
      ? name === "error"
        ? translate(values[name], id)
        : String(values[name])
      : token
  );
  return (
    String(source).match(/^\s*/)[0] + result + String(source).match(/\s*$/)[0]
  );
}

export function createTranslator(getLanguage) {
  return (source, params) => {
    revision.value;
    const requested = getLanguage();
    const ready = [...requiredGroups].every((group) =>
      loaded.has(`${requested}:${group}`)
    );
    return translate(source, ready ? requested : activeLanguage.value, params);
  };
}
