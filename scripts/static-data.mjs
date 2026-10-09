import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function writeLanguageFiles(workspace) {
  const dataPath = path.join(workspace, 'data')
  const languages = JSON.parse(await readFile(path.join(dataPath, 'loc.json'), 'utf8'))
  const languagePath = path.join(dataPath, 'loc')
  await mkdir(languagePath, { recursive: true })
  await Promise.all(Object.entries(languages).map(([language, data]) =>
    writeFile(path.join(languagePath, `${language}.json`), JSON.stringify(data)),
  ))
}
