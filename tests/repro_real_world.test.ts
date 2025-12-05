
import { describe, expect, it } from 'vitest'
import { assertCode, compile } from './utils'

describe('repro real world', () => {
  it('should work without ignore (robust fallback)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    import type { SelectProps as VcSelectProps } from '@v-c/select'
    
    interface Props extends Omit<VcSelectProps, 'mode'> {
      x: number
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`x: { type: Number, required: true }`)
  })

  it('should work with ignore before Omit', () => {
    const { content } = compile(`
    <script setup lang="ts">
    import type { SelectProps as VcSelectProps } from '@v-c/select'
    
    interface Props extends /* @vue-ignore */ Omit<VcSelectProps, 'mode'> {
      x: number
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`x: { type: Number, required: true }`)
  })
})
