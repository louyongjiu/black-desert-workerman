import { computed, watchEffect } from 'vue';
import { useUserStore } from '../stores/user';
import { createTranslator, languages } from './index.mjs';

export function useUiI18n() {
  const user = useUserStore();
  const t = createTranslator(() => user.selectedLang);
  const locale = computed(
    () => languages[user.selectedLang]?.locale || languages.en.locale
  );
  return { t, locale };
}

export function installUiI18n(app, user) {
  app.config.globalProperties.$t = createTranslator(() => user.selectedLang);
  watchEffect(() => {
    document.documentElement.lang = languages[user.selectedLang]?.html || 'en';
  });
}
