import { describe, expect, it } from 'vitest'
import { compile } from './utils'

describe('Pick with keys the source does not have', () => {
  it('keeps the present keys and ignores the missing ones instead of crashing', () => {
    const { content } = compile(`
    <script setup lang="ts">
    interface Base { a?: string, b?: number }
    type P = Pick<Base, 'a' | 'missing'>
    defineProps<P>()
    </script>
    `)
    expect(content).toMatch(/a: \{ type: String, required: false \}/)
    expect(content).not.toMatch(/missing/)
  })

  it('survives a source that only resolved partially', () => {
    // `Base` extends something unresolvable, so it contributes only its own
    // members; a Pick that also asks for an inherited key must not blow up.
    const { content } = compile(`
    <script setup lang="ts">
    import type { Missing } from './does-not-exist'
    interface Base extends /* @vue-ignore */ Missing { own?: boolean }
    type P = Pick<Base, 'own' | 'inherited'>
    defineProps<P>()
    </script>
    `)
    expect(content).toMatch(/own: \{ type: Boolean, required: false \}/)
    expect(content).not.toMatch(/inherited/)
  })
})
