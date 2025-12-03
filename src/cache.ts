import { LRUCache } from 'lru-cache'

export function createCache<T extends Record<string, any>>(
  max = 500,
): Map<string, T> | LRUCache<string, T> {
  /* v8 ignore next 3 */
  // @ts-expect-error globalThis
  if (globalThis.__GLOBAL__ || globalThis.__ESM_BROWSER__) {
    return new Map<string, T>()
  }
  return new LRUCache({ max })
}
