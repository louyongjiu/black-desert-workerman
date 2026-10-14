export const languages = Object.freeze({
  en: { name: "English", locale: "en-US", html: "en" },
  tw: { name: "繁體中文", locale: "zh-TW", html: "zh-Hant" },
  ru: { name: "Русский", locale: "ru-RU", html: "ru" },
  ko: { name: "한국어", locale: "ko-KR", html: "ko" },
  jp: { name: "日本語", locale: "ja-JP", html: "ja" },
});
export const localeIds = Object.keys(languages);
export const normalize = (text) =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();

export const uiNamespaces = [
  "common",
  "housing",
  "optimizer",
  "research",
  "about",
];
export function uiGroupsForRoute(path) {
  if (path === "/about") return ["common", "about"];
  if (path === "/fishsize" || path === "/droprates" || path === "/resources")
    return ["common", "research"];
  if (path === "/optimizer") return ["common", "housing", "optimizer"];
  if (
    [
      "/",
      "/settings",
      "/workshops",
      "/housecraft",
      "/lodging",
      "/routertests",
      "/plantzones",
    ].includes(path)
  )
    return ["common", "housing"];
  return ["common"];
}
