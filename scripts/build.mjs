import { fileURLToPath } from 'node:url'
import { readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'
import { writeLanguageFiles } from './static-data.mjs'
import { createRuntimeAssetPlan, writeRuntimeAssets } from './runtime-assets.mjs'

const workspace = fileURLToPath(new URL('..', import.meta.url))
await writeLanguageFiles(workspace)
const runtime = await createRuntimeAssetPlan(workspace)
const result = await build({
  configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
  define: { __RESOURCE_MANIFEST__: JSON.stringify(runtime.manifest) },
})
const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output)
const currentAssets = new Set(outputs.map(output => output.fileName))
const distPath = path.join(workspace, 'dist')
const assetsPath = path.join(distPath, 'assets')
for (const filename of await readdir(assetsPath)) {
  if (/\.[a-f0-9]{8}\.(js|css|wasm|png)$/.test(filename) && !currentAssets.has(`assets/${filename}`)) {
    await unlink(path.join(assetsPath, filename))
  }
}
await writeRuntimeAssets(workspace, runtime)
console.log(`Published ${runtime.assets.length} versioned runtime assets (${runtime.assets.reduce((sum, asset) => sum + asset.contents.length, 0)} bytes)`)
