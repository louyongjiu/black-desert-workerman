import { computed, watch } from "vue";
import { useUserStore } from "../stores/user";
import { activateUiLanguage, createTranslator, languages } from "./index.mjs";

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
  let generation = 0;
  watch(
    () => user.selectedLang,
    async (language) => {
      const current = ++generation;
      try {
        await activateUiLanguage(language);
        if (current === generation)
          document.documentElement.lang = languages[language]?.html || "en";
      } catch (error) {
        console.error("UI language load failed", error);
      }
    },
    { immediate: true }
  );
}
