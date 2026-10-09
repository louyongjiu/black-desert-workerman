/* global __RESOURCE_MANIFEST__, __RESOURCE_BASE_URL__ */
export const resourceManifest = typeof __RESOURCE_MANIFEST__ === 'undefined' ? {} : __RESOURCE_MANIFEST__
const resourceBase = typeof __RESOURCE_BASE_URL__ === 'undefined' ? '/workerman/' : __RESOURCE_BASE_URL__

export function createResourceUrl(manifest, base = '/workerman/') {
  const prefixes = Object.keys(manifest).filter(key => key.endsWith('/')).sort((a, b) => b.length - a.length)
  const root = base.replace(/\/$/, '') + '/'
  return path => {
    if (!path.startsWith('data/')) return path
    const prefix = prefixes.find(key => path.startsWith(key))
    const versioned = manifest[path] || (prefix ? manifest[prefix] + path.slice(prefix.length) : path)
    return root + versioned
  }
}

export const resourceUrl = createResourceUrl(resourceManifest, resourceBase)
