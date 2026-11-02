export function normalizeBase(value = ''): string {
  const base = value.replace(/\/+$/, '')
  if (base && !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(base)) throw new Error('Invalid BASE_PATH')
  return base
}

export function injectConfig(html: string, base: string): string {
  return html.replace('<!-- runtime-config -->', `<base href="${base}/"><script id="app-config" type="application/json">${JSON.stringify({ basePath: base }).replace(/</g, '\\u003c')}</script>`)
}
