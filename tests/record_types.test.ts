
import { describe, expect, it } from 'vitest'
import { compile, assertCode } from './utils'
import { BindingTypes } from '@vue/compiler-core'

describe('Record types', () => {
  it('Record<string, any> (Index Signature)', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    defineProps<Record<string, any>>()
    </script>
    `)
    // assertCode(content) // Content might be empty if no props generated
    // Should be empty or no specific props
    expect(Object.keys(bindings || {})).toHaveLength(0)
  })

  it('Record<Union, Type>', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    defineProps<Record<'foo' | 'bar', number>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`foo: { type: Number, required: false }`)
    expect(content).toMatch(`bar: { type: Number, required: false }`)
    expect(bindings).toMatchObject({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
    })
  })

  it('Record<keyof T, Type>', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props {
      a: string
      b: number
    }
    defineProps<Record<keyof Props, boolean>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`a: { type: Boolean, required: false }`)
    expect(content).toMatch(`b: { type: Boolean, required: false }`)
    expect(bindings).toMatchObject({
      a: BindingTypes.PROPS,
      b: BindingTypes.PROPS,
    })
  })

  it('Record<keyof T, any> (No Type)', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props {
      a: string
    }
    defineProps<Record<keyof Props, any>>()
    </script>
    `)
    assertCode(content)
    // Should have type: null (any)
    expect(content).toMatch(`a: { type: null, required: false }`)
    expect(bindings).toMatchObject({
      a: BindingTypes.PROPS,
    })
  })
})
