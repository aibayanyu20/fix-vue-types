
import { describe, expect, it } from 'vitest'
import { compile, assertCode } from './utils'
import { BindingTypes } from '@vue/compiler-core'

describe('complex types', () => {
  it('Required<T>', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props {
      foo?: string
      bar: number
    }
    defineProps<Required<Props>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`foo: { type: String, required: true }`)
    expect(content).toMatch(`bar: { type: Number, required: true }`)
    expect(bindings).toMatchObject({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
    })
  })

  it('Partial<T>', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props {
      foo: string
      bar?: number
    }
    defineProps<Partial<Props>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`foo: { type: String, required: false }`)
    expect(content).toMatch(`bar: { type: Number, required: false }`)
    expect(bindings).toMatchObject({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
    })
  })

  it('Pick with Exclude (Omit behavior)', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props {
      foo: string
      bar: number
      baz: boolean
    }
    defineProps<Pick<Props, Exclude<keyof Props, 'baz'>>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`foo: { type: String, required: true }`)
    expect(content).toMatch(`bar: { type: Number, required: true }`)
    expect(content).not.toMatch(`baz`)
    expect(bindings).toMatchObject({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
    })
  })

  it('Omit with Extract', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props {
      foo: string
      bar: number
      baz: boolean
    }
    defineProps<Omit<Props, Extract<keyof Props, 'baz' | 'bar'>>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`foo: { type: String, required: true }`)
    expect(content).not.toMatch(`bar`)
    expect(content).not.toMatch(`baz`)
    expect(bindings).toMatchObject({
      foo: BindingTypes.PROPS,
    })
  })

  it('Complex Intersection', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface A { a: string }
    interface B { b: number }
    interface C { c: boolean; d: string }
    
    type Complex = A & B & Pick<C, 'c'>
    
    defineProps<Complex>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`a: { type: String, required: true }`)
    expect(content).toMatch(`b: { type: Number, required: true }`)
    expect(content).toMatch(`c: { type: Boolean, required: true }`)
    expect(content).not.toMatch(`d: {`)
    expect(bindings).toMatchObject({
      a: BindingTypes.PROPS,
      b: BindingTypes.PROPS,
      c: BindingTypes.PROPS,
    })
  })
  
  it('Complex Type Gymnastics', () => {
      const { content, bindings } = compile(`
      <script setup lang="ts">
      interface A { a: string }
      interface B { b: number }
      interface C { c: boolean; d: string }
      interface D { d: string }
      interface E { e: string; f: number }
      interface F { f: number }
      
      type Custom = A & B & Omit<C, keyof D> & Pick<E, keyof F>
      
      defineProps<Custom>()
      </script>
      `)
      assertCode(content)
      expect(content).toMatch(`a: { type: String, required: true }`)
      expect(content).toMatch(`b: { type: Number, required: true }`)
      expect(content).toMatch(`c: { type: Boolean, required: true }`)
      expect(content).not.toMatch(`d: {`) // Omitted from C
      expect(content).toMatch(`f: { type: Number, required: true }`) // Picked from E
      expect(content).not.toMatch(`e: {`) // Not picked from E
      
      expect(bindings).toMatchObject({
        a: BindingTypes.PROPS,
        b: BindingTypes.PROPS,
        c: BindingTypes.PROPS,
        f: BindingTypes.PROPS,
      })
    })

  it('Extract<T, U> with object types', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface A { a: string }
    interface B { b: number }
    type Union = A | B
    
    defineProps<Extract<Union, A>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`a: { type: String, required: true }`)
    expect(content).not.toMatch(`b: {`)
    expect(bindings).toMatchObject({
      a: BindingTypes.PROPS,
    })
  })

  it('Exclude<T, U> with object types', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface A { a: string }
    interface B { b: number }
    type Union = A | B
    
    defineProps<Exclude<Union, A>>()
    </script>
    `)
    assertCode(content)
    expect(content).not.toMatch(`a: {`)
    expect(content).toMatch(`b: { type: Number, required: true }`)
    expect(bindings).toMatchObject({
      b: BindingTypes.PROPS,
    })
  })
})
