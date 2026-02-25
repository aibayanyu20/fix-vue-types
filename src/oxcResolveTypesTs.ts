import type { TsModule } from './types'

let registeredTS: TsModule | undefined

export function registerTS(ts: TsModule): void {
  registeredTS = ts
}

export function getRegisteredTS(): TsModule | undefined {
  return registeredTS
}

export function getRegisteredTSOrThrow(): TsModule {
  if (!registeredTS) {
    throw new Error(
      '[oxc-vue-jsx/resolve-types] TypeScript is required to resolve non-relative imports. Call registerTS(ts) first.',
    )
  }

  return registeredTS
}
