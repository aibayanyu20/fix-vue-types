import { describe, expect, it } from 'vitest'
import { extractRuntimeEmits } from '../src/defineEmits'

describe('defineEmits check', () => {
  it('import defineEmits', () => {
    expect(extractRuntimeEmits).toBeDefined()
  })
})
