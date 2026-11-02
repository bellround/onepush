import { glob, readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

export async function sourceCatalog(): Promise<string[]> {
  const root = fileURLToPath(new URL('../src/levels', import.meta.url))
  const paths: string[] = []
  for await (const path of glob('chapter/ch*/*.ts', { cwd: root })) paths.push(path)
  const ids: string[] = []
  for (const path of paths.sort()) {
    const { default: level } = await import(pathToFileURL(resolve(root, path)).href)
    if (typeof level.id !== 'string' || !/^ch\d+-\d+$/.test(level.id) || ids.includes(level.id)) throw new Error(`Invalid or duplicate level id ${level.id} in ${path}`)
    ids.push(level.id)
  }
  if (!ids.length) throw new Error('Empty level catalog')
  return ids
}

export async function loadCatalog(): Promise<string[]> {
  if (process.env.NODE_ENV !== 'production') return sourceCatalog()
  return JSON.parse(await readFile(new URL('../dist/level-catalog.json', import.meta.url), 'utf8')) as string[]
}
