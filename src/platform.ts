function basePath(): string {
  if (typeof document === 'undefined') return ''
  const config = document.getElementById('app-config')?.textContent
  if (!config) return ''
  const base: unknown = JSON.parse(config).basePath
  return typeof base === 'string' && /^(?:\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+)?$/.test(base) ? base : ''
}

export function appPath(path: string): string {
  return `${basePath()}/${path.replace(/^\/+/, '')}`
}

export function apiUrl(path: string): string {
  return appPath(`/api/${path.replace(/^\/+/, '')}`)
}
