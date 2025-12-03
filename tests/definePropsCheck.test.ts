import { describe, expect, it } from 'vitest'
import { extractRuntimeProps } from '../src/defineProps'

describe('defineProps check', () => {
  it('import defineProps', () => {
    expect(extractRuntimeProps).toBeDefined()
  })
})
