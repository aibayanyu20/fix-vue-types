import { describe, expect, it } from 'vitest'
import { compile } from './utils'

// Mirrors the layout of a published @v-c/mini-decimal consumed by a published
// @v-c/input-number: the consumer's d.ts points at `../../pkg/src` (a path that
// only existed in the monorepo), and the package's entry re-exports a type it
// imported (`import { ValueType } from './interface'; export type { ValueType }`)
// behind an `export *`.
describe('published d.ts chains', () => {
  it('falls back from ../pkg/src to ../pkg/dist and follows export { imported }', () => {
    const { content } = compile(`
    <script setup lang="ts">
    import type { Props } from './tests/fixtures/src-dist-fallback/consumer/dist/types'
    defineProps<Props>()
    </script>
    `)
    expect(content).toMatch(/min: \{ type: \[String, Number\], required: false \}/)
  })

  it('resolves a re-exported imported type directly', () => {
    const { content } = compile(`
    <script setup lang="ts">
    import type { ValueType } from './tests/fixtures/src-dist-fallback/pkg/dist'
    defineProps<{ v: ValueType }>()
    </script>
    `)
    expect(content).toMatch(/v: \{ type: \[String, Number\], required: true \}/)
  })
})
