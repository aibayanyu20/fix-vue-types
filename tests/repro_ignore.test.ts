
import { describe, expect, it } from 'vitest'
import { assertCode, compile } from './utils'
import { BindingTypes } from '@vue/compiler-core'

describe('repro ignore', () => {
  it('should ignore unresolved extends with comment', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Base {
      x: string
    }
    // Simulate an unresolved base by using a name that is not defined in the scope or imports
    // But wait, if it's not defined, it might be treated as global or error?
    // In the real issue, it's likely an import that resolveType fails to resolve (e.g. from a library)
    
    interface Props extends /* @vue-ignore */ UnresolvedBase {
      y: number
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`y: { type: Number, required: true }`)
    // Should not have x
    expect(content).not.toMatch(`x:`)
  })

  it('should ignore unresolved extends with comment (complex)', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    import { SomeExternal } from 'some-lib'
    
    interface Props extends /* @vue-ignore */ SomeExternal {
      z: number
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`z: { type: Number, required: true }`)
  })

  it('should ignore unresolved extends with comment (multiple)', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface A { a: string }
    
    interface Props extends A, /* @vue-ignore */ Unresolved {
      b: number
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`a: { type: String, required: true }`)
    expect(content).toMatch(`b: { type: Number, required: true }`)
  })

  it('should ignore unresolved extends with comment (multiline)', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props extends 
      /* @vue-ignore */
      Unresolved {
      c: number
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`c: { type: Number, required: true }`)
  })

  it('should support Omit in extends', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Base { a: string; b: number }
    interface Props extends Omit<Base, 'a'> {
      c: boolean
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`b: { type: Number, required: true }`)
    expect(content).toMatch(`c: { type: Boolean, required: true }`)
    expect(content).not.toMatch(`a:`)
  })

  it('should ignore unresolved Omit base with comment', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props extends /* @vue-ignore */ Omit<Unresolved, 'a'> {
      c: boolean
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`c: { type: Boolean, required: true }`)
  })

  it('should support chained Omit and extends', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Base { a: string; b: number }
    interface Mid extends Omit<Base, 'a'> {
      c: boolean
    }
    interface Props extends Omit<Mid, 'b'> {
      d: string
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`c: { type: Boolean, required: true }`)
    expect(content).toMatch(`d: { type: String, required: true }`)
    expect(content).not.toMatch(`a:`)
    expect(content).not.toMatch(`b:`)
  })

  it('should support ignore inside Omit type argument', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props extends Omit</* @vue-ignore */ Unresolved, 'a'> {
      c: boolean
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`c: { type: Boolean, required: true }`)
  })

  it('should support Omit with multiple keys', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Base { a: string; b: number; c: boolean }
    interface Props extends Omit<Base, 'a' | 'b'> {
      d: string
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`c: { type: Boolean, required: true }`)
    expect(content).toMatch(`d: { type: String, required: true }`)
    expect(content).not.toMatch(`a:`)
    expect(content).not.toMatch(`b:`)
  })
})
