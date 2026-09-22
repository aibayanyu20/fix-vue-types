import { describe, expect, it } from 'vitest'
import { compile } from './utils'

describe('type parameter defaults', () => {
  it('uses the declared default when an interface is referenced without arguments', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type V = string | number
    interface P<T extends V = V> { min?: T, step?: V }
    defineProps<P>()
    </script>
    `)
    expect(content).toMatch(/min: \{ type: \[String, Number\], required: false \}/)
    expect(content).toMatch(/step: \{ type: \[String, Number\], required: false \}/)
  })

  it('still lets an explicit argument override the default', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type V = string | number
    interface P<T extends V = V> { min?: T }
    defineProps<P<boolean>>()
    </script>
    `)
    expect(content).toMatch(/min: \{ type: Boolean, required: false \}/)
  })

  it('applies the default through Omit and extends', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type V = string | number
    interface P<T extends V = V> { min?: T, x?: string }
    interface Q extends Omit<P, 'x'> { y?: number }
    defineProps<Q>()
    </script>
    `)
    expect(content).toMatch(/min: \{ type: \[String, Number\], required: false \}/)
    expect(content).not.toMatch(/\bx:/)
    expect(content).toMatch(/y: \{ type: Number, required: false \}/)
  })

  it('applies the default on a generic type alias', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type Wrap<T = string> = { v?: T }
    defineProps<Wrap>()
    </script>
    `)
    expect(content).toMatch(/v: \{ type: String, required: false \}/)
  })

  it('resolves a default declared in another file, through Omit in a third file', () => {
    // `ValueType` only exists in pkg/dist/interface.d.ts; the default
    // `= ValueType` must be resolved there, not in the consumer.
    const { content } = compile(`
    <script setup lang="ts">
    import type { InputNumberProps } from './tests/fixtures/src-dist-fallback/pkg/dist/InputNumber'
    interface Props extends Omit<InputNumberProps, 'class'> { extra?: boolean }
    defineProps<Props>()
    </script>
    `)
    expect(content).toMatch(/min: \{ type: \[String, Number\], required: false \}/)
    expect(content).toMatch(/max: \{ type: \[String, Number\], required: false \}/)
    expect(content).toMatch(/step: \{ type: \[String, Number\], required: false \}/)
    expect(content).not.toMatch(/\bclass:/)
    expect(content).toMatch(/extra: \{ type: Boolean, required: false \}/)
  })
})
