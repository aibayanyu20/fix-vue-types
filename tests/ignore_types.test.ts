import { beforeEach, describe, expect, it } from 'vitest'
import { invalidateTypeCache } from '../src'
import { compile } from './utils'

const fixtures = './tests/fixtures/ignore-types'
// The SFC harness compiles `anonymous.vue` in the cwd, so the resolver keys
// its file-scope cache by the relative path; invalidate both spellings.
const fixtureFiles = ['pkg/dist/index.d.ts', 'util.d.ts', 'reexport.ts']
  .flatMap(f => [`tests/fixtures/ignore-types/${f}`, `${process.cwd()}/tests/fixtures/ignore-types/${f}`])

function props(content: string) {
  return [...content.matchAll(/^\s+(['"\w:]+): \{ ([^}]*)\}/gm)].map(m => [m[1], m[2].trim()] as const)
}
function keys(content: string) {
  return props(content).map(([k]) => k.replace(/^["']|["']$/g, ''))
}

describe('VueIgnore<T> wrapper', () => {
  it('drops the members of a wrapped extends base', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type VueIgnore<T> = T
    interface Emits { onChange?: () => void }
    interface Base { value?: string }
    interface Props extends Base, VueIgnore<Emits> { extra?: boolean }
    defineProps<Props>()
    </script>
    `)
    expect(keys(content)).toEqual(['extra', 'value'])
  })

  it('infers a wrapped property type to null', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type VueIgnore<T> = T
    interface Heavy { a: string }
    defineProps<{ x?: VueIgnore<Heavy>, y?: string }>()
    </script>
    `)
    expect(content).toMatch(/x: \{ required: false \}/)
    expect(content).toMatch(/y: \{ type: String, required: false \}/)
  })

  it('yields nothing through Omit, Partial and an intersection', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type VueIgnore<T> = T
    interface Base { a?: string, b?: number }
    type P = Omit<VueIgnore<Base>, 'a'> & Partial<VueIgnore<Base>> & VueIgnore<Base> & { own?: string }
    defineProps<P>()
    </script>
    `)
    expect(keys(content)).toEqual(['own'])
  })

  it('handles keyof and indexed access on a wrapped type without throwing', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type VueIgnore<T> = T
    interface Base { a?: string, b?: number }
    type Arr = string[]
    interface Props {
      k?: keyof VueIgnore<Base>
      el?: VueIgnore<Arr>[number]
      picked?: Pick<Base, keyof VueIgnore<Base>>
    }
    defineProps<Props>()
    </script>
    `)
    expect(content).toMatch(/k: \{ required: false \}/)
    expect(content).toMatch(/el: \{ required: false \}/)
    expect(content).toMatch(/picked: \{ type: Object, required: false \}/)
  })

  it('applies to a generic default', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type VueIgnore<T> = T
    interface Base { a?: string }
    interface Wrap<T = VueIgnore<Base>> { v?: T, w?: string }
    defineProps<Wrap>()
    </script>
    `)
    expect(content).toMatch(/v: \{ required: false \}/)
    expect(content).toMatch(/w: \{ type: String, required: false \}/)
  })

  it('matches a qualified or renamed reference by its last segment', () => {
    const { content } = compile(`
    <script setup lang="ts">
    declare namespace ns { type VueIgnore<T> = T }
    interface Emits { onChange?: () => void }
    interface Props extends ns.VueIgnore<Emits> { own?: string }
    defineProps<Props>()
    </script>
    `)
    expect(keys(content)).toEqual(['own'])
  })
})

describe('ignoreTypes option', () => {
  const src = `
    <script setup lang="ts">
    interface TabsEmitsProps { onChange?: () => void }
    interface IgnoreCase { flag?: boolean }
    interface Base { value?: string }
    interface Props extends Base, TabsEmitsProps, IgnoreCase { extra?: boolean }
    defineProps<Props>()
    </script>
  `

  it('is off by default', () => {
    expect(keys(compile(src).content)).toEqual(['extra', 'value', 'onChange', 'flag'])
  })

  it('accepts anchored regular expressions and leaves other names alone', () => {
    expect(keys(compile(src, { ignoreTypes: [/EmitsProps$/] }).content)).toEqual(['extra', 'value', 'flag'])
    expect(keys(compile(src, { ignoreTypes: [/^Ignore/] }).content)).toEqual(['extra', 'value', 'onChange'])
  })

  it('accepts exact strings and a predicate', () => {
    expect(keys(compile(src, { ignoreTypes: ['TabsEmitsProps'] }).content)).toEqual(['extra', 'value', 'flag'])
    expect(keys(compile(src, { ignoreTypes: (name: string) => name.endsWith('Case') }).content)).toEqual(['extra', 'value', 'onChange'])
  })

  it('also applies to property types', () => {
    const { content } = compile(`
    <script setup lang="ts">
    interface HeavyIgnored { a: string }
    defineProps<{ x?: HeavyIgnored, y?: string }>()
    </script>
    `, { ignoreTypes: [/Ignored$/] })
    expect(content).toMatch(/x: \{ required: false \}/)
    expect(content).toMatch(/y: \{ type: String, required: false \}/)
  })
})

describe('published d.ts without comments', () => {
  beforeEach(() => {
    fixtureFiles.forEach(invalidateTypeCache)
  })

  it('leaks emits members without a marker, which is the problem being solved', () => {
    const { content } = compile(`
    <script setup lang="ts">
    import type { TabsProps } from '${fixtures}/pkg/dist'
    defineProps<TabsProps>()
    </script>
    `)
    expect(keys(content)).toEqual(['centered', 'activeKey', 'size', 'onChange', 'onUpdate:activeKey'])
  })

  it('ignoreTypes fixes it without touching the package', () => {
    const { content } = compile(`
    <script setup lang="ts">
    import type { TabsProps } from '${fixtures}/pkg/dist'
    defineProps<TabsProps>()
    </script>
    `, { ignoreTypes: [/EmitsProps$/] })
    expect(keys(content)).toEqual(['centered', 'activeKey', 'size'])
  })

  it('VueIgnore in the published d.ts works with no option, also through a re-export', () => {
    const direct = compile(`
    <script setup lang="ts">
    import type { ButtonProps } from '${fixtures}/pkg/dist'
    defineProps<ButtonProps>()
    </script>
    `).content
    expect(keys(direct)).toEqual(['loading', 'activeKey', 'size'])

    fixtureFiles.forEach(invalidateTypeCache)
    const viaReexport = compile(`
    <script setup lang="ts">
    import type { ButtonProps } from '${fixtures}/reexport'
    defineProps<ButtonProps>()
    </script>
    `).content
    expect(keys(viaReexport)).toEqual(['loading', 'activeKey', 'size'])
  })
})

describe('@vue-ignore comment', () => {
  it('is still honoured, including the JSDoc form on a member', () => {
    const { content } = compile(`
    <script setup lang="ts">
    interface Emits { onChange?: () => void }
    interface Heavy { a: string }
    interface Props extends /* @vue-ignore */ Emits {
      /** @vue-ignore */
      x?: Heavy
      y?: string
    }
    defineProps<Props>()
    </script>
    `)
    expect(keys(content)).toEqual(['x', 'y'])
    expect(content).toMatch(/x: \{ required: false \}/)
  })
})
