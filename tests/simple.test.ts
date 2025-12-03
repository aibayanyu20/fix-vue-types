import { describe, expect, it } from 'vitest'
import { ScriptCompileContext } from '../src/context'

describe('simple', () => {
  it('import context', () => {
    expect(ScriptCompileContext).toBeDefined()
  })
})
