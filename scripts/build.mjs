import { fileURLToPath } from 'node:url'
import { cp, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'
import { writeLanguageFiles } from './static-data.mjs'

const workspace = fileURLToPath(new URL('..', import.meta.url))
await writeLanguageFiles(workspace)
const result = await build({ configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)) })
const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output)
const currentAssets = new Set(outputs.map(output => output.fileName))
const distPath = path.join(workspace, 'dist')
const assetsPath = path.join(distPath, 'assets')
for (const filename of await readdir(assetsPath)) {
  if (/\.[a-f0-9]{8}\.(js|css|wasm|png)$/.test(filename) && !currentAssets.has(`assets/${filename}`)) {
    await unlink(path.join(assetsPath, filename))
  }
}
// Runtime JSON and icons are fetched separately from the JavaScript bundle.
const dataPath = path.join(workspace, 'data')
await cp(dataPath, path.join(distPath, 'data'), {
  recursive: true,
})
