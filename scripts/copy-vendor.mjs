import { copyFile, mkdir } from 'node:fs/promises'

const assetsDirectory = new URL('../public/assets/', import.meta.url)

const vendorAssets = [
  {
    source: new URL('../node_modules/htmx.org/dist/htmx.min.js', import.meta.url),
    destination: new URL('htmx.min.js', assetsDirectory),
  },
  {
    source: new URL('../node_modules/sortablejs/Sortable.min.js', import.meta.url),
    destination: new URL('sortable.min.js', assetsDirectory),
  },
  {
    source: new URL('../src/client/admin.js', import.meta.url),
    destination: new URL('admin.js', assetsDirectory),
  },
]

await mkdir(assetsDirectory, { recursive: true })
await Promise.all(
  vendorAssets.map(({ source, destination }) => copyFile(source, destination)),
)
