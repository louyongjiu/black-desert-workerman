import core from "./core.mjs";
import research from "./research.mjs";
import optimizer from "./optimizer.mjs";
import about from "./about.mjs";
import housing from "./housing.mjs";
import empireHousing from "./empireHousing.mjs";
import housingWorkbench from "./housingWorkbench.mjs";
import usability from "./usability.mjs";
import { common as extra, optimizer as optimizerExtra } from "./extra.mjs";

import { languages, normalize } from "./meta.mjs";
export { languages, normalize };
export const messages = Object.create(null);

function addTable(table, sourceIsEnglish = true) {
  for (const line of table.trim().split("\n")) {
    const [source, ...values] = line.trim().split("¦");
    const translations = sourceIsEnglish ? [source, ...values] : values;
    if (translations.length !== 5 || translations.some((value) => !value)) {
      throw new Error(`Incomplete UI translation: ${source}`);
    }
    messages[normalize(source)] = Object.fromEntries(
      ["en", "tw", "ru", "ko", "jp"].map((id, index) => [
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
addTable(usability);
addTable(research);
addTable(optimizer, false);
addTable(extra);
addTable(optimizerExtra, false);
for (const [source, values] of Object.entries(about)) {
  messages[normalize(source)] = Object.fromEntries(
    ["en", "tw", "ru", "ko", "jp"].map((id, index) => [
      id,
      index === 0 ? source : values[index - 1],
    ])
  );
}

// Build/test-only catalogue. The application loads generated per-language files.
const tables = {
  common: [[core], [usability], [extra]],
  housing: [[housing], [empireHousing], [housingWorkbench]],
  optimizer: [
    [optimizer, false],
    [optimizerExtra, false],
  ],
  research: [[research]],
};
export function compileUiCatalogs() {
  const groups = Object.fromEntries(
    Object.entries(tables).map(([group, list]) => [
      group,
      [
        ...new Set(
          list.flatMap(([table]) =>
            table
              .trim()
              .split("\n")
              .map((line) => normalize(line.trim().split("¦")[0]))
          )
        ),
      ],
    ])
  );
  groups.about = Object.keys(about).map(normalize);
  // The optimizer link is part of the shell on every route.
  groups.common.push("帝国优化", "价格更新于 {date}");
  return Object.fromEntries(
    Object.keys(languages).map((language) => [
      language,
      Object.fromEntries(
        Object.entries(groups).map(([group, keys]) => [
          group,
          Object.fromEntries(keys.map((key) => [key, messages[key][language]])),
        ])
      ),
    ])
  );
}
