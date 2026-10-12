import koreanOverrides from './koGame.mjs';
import { translate } from './index.mjs';

// Repair display-only fallbacks; preserve game IDs and numerical data.
export function localizeGameLanguage(data, language) {
  const result = { ...data };
  if (language === 'ko') {
    for (const [category, overrides] of Object.entries(koreanOverrides)) {
      result[category] = { ...data[category], ...overrides };
    }
  }
  result.node = Object.fromEntries(
    Object.entries(data.node || {}).map(([id, name]) => [
      id,
      name === 'UnKnown' ? translate('unknown', language) : name,
    ])
  );
  return result;
}
