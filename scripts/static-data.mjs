import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { compileUiCatalogs } from '../src/i18n/catalog.mjs'

export async function writeLanguageFiles(workspace) {
  const dataPath = path.join(workspace, 'data')
  const languages = JSON.parse(await readFile(path.join(dataPath, 'loc.json'), 'utf8'))
  const languagePath = path.join(dataPath, 'loc')
  await mkdir(languagePath, { recursive: true })
  await Promise.all(Object.entries(languages).map(([language, data]) =>
    writeFile(path.join(languagePath, `${language}.json`), JSON.stringify(data)),
  ))
  await Promise.all(Object.entries(compileUiCatalogs()).flatMap(([language, groups]) =>
    Object.entries(groups).map(async ([group, dictionary]) => {
      const directory = path.join(dataPath, 'ui', language)
      await mkdir(directory, { recursive: true })
      await writeFile(path.join(directory, `${group}.json`), JSON.stringify(dictionary))
    }),
  ))
}
