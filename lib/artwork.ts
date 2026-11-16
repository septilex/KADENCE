/** Request atlas-sized images without importing the WebGL renderer into the homepage. */
export function getOptimizedArtworkUrl(url: string, size: 100 | 256 | 600 = 256): string {
  if (!url) return ''
  if (url.includes('mzstatic.com')) return url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`)
  return url
}
