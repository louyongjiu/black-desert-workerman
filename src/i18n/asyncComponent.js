import { defineAsyncComponent } from "vue";
import { useUserStore } from "../stores/user";
import { loadUiMessages } from "./index.mjs";

export function localizedAsyncComponent(load, groups = []) {
  return defineAsyncComponent(async () => {
    const user = useUserStore();
    let language = user.selectedLang;
    const [component] = await Promise.all([
      load(),
      loadUiMessages(language, groups),
    ]);
    while (language !== user.selectedLang) {
      language = user.selectedLang;
      await loadUiMessages(language, groups);
    }
    return component;
  });
}
