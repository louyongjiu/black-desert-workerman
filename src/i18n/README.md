# Interface translations

The interface supports the same five languages as the game data: `en`, `tw`,
`ru`, `ko`, and `jp`. The user preference drives both systems. `$t(source, params)`
is available in every template and Options API component; script setup can use
`useUiI18n()`. Translate display labels, never stored job kinds, server codes,
option values, user-entered names, or the game entity dictionaries.

`core.mjs`, `research.mjs`, and `extra.mjs` use rows separated by `¦`, with an
English source followed by Traditional Chinese, Russian, Korean, and Japanese.
`optimizer.mjs` additionally has an English column because its original source
messages were Chinese. `about.mjs` contains the longer help messages.

`catalog.mjs` combines these source tables during builds and tests. The runtime
loads generated `data/ui/<language>/<group>.json` files for `common`, `housing`,
`optimizer`, `research`, and `about`; it never imports the complete catalogue.
Edit the source tables, then run `npm run build` (or start `npm run dev`) to
regenerate the dictionaries. Production publishing gives them content hashes
through the normal resource manifest. Route guards and localized async
components load their groups before rendering; language changes retain the
previous labels until the required dictionaries are ready. Failed requests can
be retried. Shared navigation labels belong to `common`.

Messages are plain text; Vue escapes them. Use named placeholders for values.
Solver errors remain independent of Vue and are localized when displayed, so
switching languages also updates existing error messages. Preserve stable chart
series identifiers when translating their labels.

`game.mjs` applies display corrections to English fallbacks in the bundled
Korean game dictionary. `koGame.mjs` covers towns, houses, worker types, housing
uses, skills, and skill descriptions. Other game dictionaries and the original
data are retained. Named NPCs retain their source names.

`tests/i18n.test.mjs` checks translation completeness, placeholders, language
reactivity, template compilation, and untranslated text or attributes. Its
literal allowlist is limited to formulas, server identifiers, and proper names.
`tests/i18nLoading.test.mjs` checks catalogue splitting, duplicate-key consistency,
shared navigation, request coalescing, retries, and language switching.
